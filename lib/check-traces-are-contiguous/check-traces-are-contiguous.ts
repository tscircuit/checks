import type {
  AnyCircuitElement,
  PcbTraceError,
  PcbPort,
  PcbTrace,
  SourceTrace,
  PcbSmtPad,
  PcbPlatedHole,
} from "circuit-json"
import { isPointInPad } from "./is-point-in-pad"
import { getReadableNameForPcbPort } from "@tscircuit/circuit-json-util"

function checkTracesAreContiguous(
  circuitJson: AnyCircuitElement[],
): PcbTraceError[] {
  const errors: PcbTraceError[] = []

  const pcbPorts = circuitJson.filter(
    (el) => el.type === "pcb_port",
  ) as PcbPort[]
  const pcbTraces = circuitJson.filter(
    (el) => el.type === "pcb_trace",
  ) as PcbTrace[]
  const sourceTraces = circuitJson.filter(
    (el) => el.type === "source_trace",
  ) as SourceTrace[]
  const pcbSmtPads = circuitJson.filter(
    (el) => el.type === "pcb_smtpad",
  ) as PcbSmtPad[]
  const pcbPlatedHoles = circuitJson.filter(
    (el) => el.type === "pcb_plated_hole",
  ) as PcbPlatedHole[]

  const padMap = new Map<string, PcbSmtPad | PcbPlatedHole>()

  for (const pad of pcbSmtPads) {
    if (pad.pcb_port_id) {
      padMap.set(pad.pcb_port_id, pad)
    }
  }

  for (const hole of pcbPlatedHoles) {
    if (hole.pcb_port_id) {
      padMap.set(hole.pcb_port_id, hole)
    }
  }

  for (const trace of pcbTraces) {
    if (trace.route.length === 0) continue

    const firstPoint = trace.route[0]
    const lastPoint = trace.route[trace.route.length - 1]

    const sourceTrace = sourceTraces.find(
      (st) => st.source_trace_id === trace.source_trace_id,
    )

    const expectedPorts = sourceTrace
      ? pcbPorts.filter((port) =>
          sourceTrace.connected_source_port_ids?.includes(port.source_port_id),
        )
      : []

    for (let i = 1; i < trace.route.length - 1; i++) {
      const prevPoint = trace.route[i - 1]
      const currentPoint = trace.route[i]
      const nextPoint = trace.route[i + 1]

      if (currentPoint.route_type === "via") {
        const prevIsWire = prevPoint.route_type === "wire"
        const nextIsWire = nextPoint.route_type === "wire"

        if (prevIsWire && nextIsWire) {
          const prevAligned =
            Math.abs(prevPoint.x - currentPoint.x) < 0.001 &&
            Math.abs(prevPoint.y - currentPoint.y) < 0.001

          const nextAligned =
            Math.abs(nextPoint.x - currentPoint.x) < 0.001 &&
            Math.abs(nextPoint.y - currentPoint.y) < 0.001

          if (!prevAligned || !nextAligned) {
            const traceName =
              sourceTrace?.display_name || trace.source_trace_id || "unknown"
            errors.push({
              type: "pcb_trace_error",
              message: `Via in trace [${traceName}] is misaligned at position {x: ${currentPoint.x}, y: ${currentPoint.y}}.`,
              source_trace_id:
                sourceTrace?.source_trace_id || trace.source_trace_id || "",
              error_type: "pcb_trace_error",
              pcb_trace_id: trace.pcb_trace_id,
              pcb_trace_error_id: "",
              pcb_component_ids: [],
              pcb_port_ids: [],
            })
          }
        }
      }
    }

    const traceName =
      sourceTrace?.display_name || trace.source_trace_id || "unknown"

    // For traces with known expected ports, check specific connections
    for (const port of expectedPorts) {
      if (!port.pcb_port_id) continue

      const pad = padMap.get(port.pcb_port_id)

      if (!pad) continue

      const isFirstPointConnected =
        firstPoint.route_type === "wire" &&
        isPointInPad({ x: firstPoint.x, y: firstPoint.y }, pad)

      const isLastPointConnected =
        lastPoint.route_type === "wire" &&
        isPointInPad({ x: lastPoint.x, y: lastPoint.y }, pad)

      if (!isFirstPointConnected && !isLastPointConnected) {
        const portName = getReadableNameForPcbPort(
          circuitJson,
          port.pcb_port_id,
        ).replace("pcb_port", "")
        const padType = pad.type.replace(/pcb_/, "")
        errors.push({
          type: "pcb_trace_error",
          message: `Trace [${traceName}] is missing a connection to ${padType}${portName}`,
          source_trace_id:
            sourceTrace?.source_trace_id || trace.source_trace_id || "",
          error_type: "pcb_trace_error",
          pcb_trace_id: trace.pcb_trace_id,
          pcb_trace_error_id: "",
          pcb_component_ids: [],
          pcb_port_ids: [port.pcb_port_id],
        })
      }
    }

    // For net-level traces (no expected ports), check if endpoints are floating
    if (expectedPorts.length === 0) {
      let firstConnectsToAnyPad = false
      let lastConnectsToAnyPad = false

      for (const [portId, pad] of padMap) {
        if (
          firstPoint.route_type === "wire" &&
          isPointInPad({ x: firstPoint.x, y: firstPoint.y }, pad)
        ) {
          firstConnectsToAnyPad = true
        }
        if (
          lastPoint.route_type === "wire" &&
          isPointInPad({ x: lastPoint.x, y: lastPoint.y }, pad)
        ) {
          lastConnectsToAnyPad = true
        }
      }

      if (!firstConnectsToAnyPad && firstPoint.route_type === "wire") {
        errors.push({
          type: "pcb_trace_error",
          message: `Trace [${traceName}] has disconnected endpoint at (${firstPoint.x}, ${firstPoint.y})`,
          source_trace_id:
            sourceTrace?.source_trace_id || trace.source_trace_id || "",
          error_type: "pcb_trace_error",
          pcb_trace_id: trace.pcb_trace_id,
          pcb_trace_error_id: "",
          pcb_component_ids: [],
          pcb_port_ids: [],
        })
      }
      if (!lastConnectsToAnyPad && lastPoint.route_type === "wire") {
        errors.push({
          type: "pcb_trace_error",
          message: `Trace [${traceName}] has disconnected endpoint at (${lastPoint.x}, ${lastPoint.y})`,
          source_trace_id:
            sourceTrace?.source_trace_id || trace.source_trace_id || "",
          error_type: "pcb_trace_error",
          pcb_trace_id: trace.pcb_trace_id,
          pcb_trace_error_id: "",
          pcb_component_ids: [],
          pcb_port_ids: [],
        })
      }
    }
  }

  return errors
}

export { checkTracesAreContiguous }
