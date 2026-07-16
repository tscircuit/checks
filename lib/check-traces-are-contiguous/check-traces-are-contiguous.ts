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
import { distance } from "../util/distance"
import {
  getPcbPortIdsConnectedToRoutePoint,
  getPcbPortIdsConnectedToTrace,
} from "../check-each-pcb-trace-non-overlapping/getPcbPortIdsConnectedToTraces"
import {
  getReadableNameForPcbPort,
  getReadableNameForPcbTrace,
} from "@tscircuit/circuit-json-util"
import { PcbConnectivityMap } from "circuit-json-to-connectivity-map"

type PcbPortId = PcbPort["pcb_port_id"]
type PcbTraceRoutePoint = PcbTrace["route"][number]

function getRoutePointCenter(point: PcbTraceRoutePoint) {
  if (point.route_type === "through_pad") {
    return {
      x: (point.start.x + point.end.x) / 2,
      y: (point.start.y + point.end.y) / 2,
    }
  }

  return { x: point.x, y: point.y }
}

function routePointConnectsToAnotherExpectedPort(
  point: PcbTraceRoutePoint,
  expectedPorts: PcbPort[],
  missingPcbPortId: PcbPortId,
  padMap: Map<PcbPortId, Array<PcbSmtPad | PcbPlatedHole>>,
) {
  if (point.route_type !== "wire") return false

  return expectedPorts.some((expectedPort) => {
    if (
      !expectedPort.pcb_port_id ||
      expectedPort.pcb_port_id === missingPcbPortId
    ) {
      return false
    }

    const expectedPads = padMap.get(expectedPort.pcb_port_id)
    return (
      expectedPads?.some((pad) =>
        isPointInPad({ x: point.x, y: point.y }, pad, point.layer),
      ) ?? false
    )
  })
}

function getMissingConnectionErrorCenter({
  firstPoint,
  lastPoint,
  port,
  expectedPorts,
  padMap,
}: {
  firstPoint: PcbTrace["route"][number]
  lastPoint: PcbTrace["route"][number]
  port: PcbPort
  expectedPorts: PcbPort[]
  padMap: Map<PcbPortId, Array<PcbSmtPad | PcbPlatedHole>>
}) {
  let errorLocation:
    | Extract<PcbTrace["route"][number], { route_type: "wire" }>
    | undefined
  const firstWirePoint =
    firstPoint.route_type === "wire" ? firstPoint : undefined
  const lastWirePoint = lastPoint.route_type === "wire" ? lastPoint : undefined
  const firstWirePointReferencesPort = getPcbPortIdsConnectedToRoutePoint(
    firstPoint,
  ).includes(port.pcb_port_id)
  const lastWirePointReferencesPort = getPcbPortIdsConnectedToRoutePoint(
    lastPoint,
  ).includes(port.pcb_port_id)

  if (firstWirePointReferencesPort && firstWirePoint) {
    errorLocation = firstWirePoint
  } else if (lastWirePointReferencesPort && lastWirePoint) {
    errorLocation = lastWirePoint
  } else if (
    routePointConnectsToAnotherExpectedPort(
      firstPoint,
      expectedPorts,
      port.pcb_port_id,
      padMap,
    ) &&
    lastWirePoint
  ) {
    errorLocation = lastWirePoint
  } else if (
    routePointConnectsToAnotherExpectedPort(
      lastPoint,
      expectedPorts,
      port.pcb_port_id,
      padMap,
    ) &&
    firstWirePoint
  ) {
    errorLocation = firstWirePoint
  } else if (firstWirePoint && lastWirePoint) {
    errorLocation =
      distance(firstWirePoint, port) <= distance(lastWirePoint, port)
        ? firstWirePoint
        : lastWirePoint
  } else if (firstWirePoint) {
    errorLocation = firstWirePoint
  } else if (lastWirePoint) {
    errorLocation = lastWirePoint
  }

  const firstPointCenter = getRoutePointCenter(firstPoint)
  const lastPointCenter = getRoutePointCenter(lastPoint)

  return errorLocation
    ? { x: errorLocation.x, y: errorLocation.y }
    : {
        x: (firstPointCenter.x + lastPointCenter.x) / 2,
        y: (firstPointCenter.y + lastPointCenter.y) / 2,
      }
}

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

  const padMap = new Map<PcbPortId, Array<PcbSmtPad | PcbPlatedHole>>()
  const pcbConnectivityMap = new PcbConnectivityMap(circuitJson)
  const checkedSourceTraceIds = new Set<string>()

  for (const pad of pcbSmtPads) {
    if (pad.pcb_port_id) {
      padMap.set(pad.pcb_port_id, [...(padMap.get(pad.pcb_port_id) ?? []), pad])
    }
  }

  for (const hole of pcbPlatedHoles) {
    if (hole.pcb_port_id) {
      padMap.set(hole.pcb_port_id, [
        ...(padMap.get(hole.pcb_port_id) ?? []),
        hole,
      ])
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
            Math.abs(prevPoint.x - currentPoint.x) < 0.01 &&
            Math.abs(prevPoint.y - currentPoint.y) < 0.01

          const nextAligned =
            Math.abs(nextPoint.x - currentPoint.x) < 0.01 &&
            Math.abs(nextPoint.y - currentPoint.y) < 0.01

          if (!prevAligned || !nextAligned) {
            const traceName = getReadableNameForPcbTrace(
              circuitJson,
              trace.pcb_trace_id,
            )
            errors.push({
              type: "pcb_trace_error",
              message: `Via in trace [${traceName}] is misaligned at position {x: ${currentPoint.x}, y: ${currentPoint.y}}.`,
              source_trace_id:
                sourceTrace?.source_trace_id ||
                trace.source_trace_id ||
                `!${trace.pcb_trace_id}`,
              error_type: "pcb_trace_error",
              pcb_trace_id: trace.pcb_trace_id,
              pcb_trace_error_id: `misaligned_via_${trace.pcb_trace_id}_${i}`,
              pcb_component_ids: [],
              pcb_port_ids: [],
            })
          }
        }
      }
    }

    const traceName = getReadableNameForPcbTrace(
      circuitJson,
      trace.pcb_trace_id,
    )

    // Validate required ports once for the complete routed source trace.
    if (sourceTrace && expectedPorts.length > 0) {
      if (checkedSourceTraceIds.has(sourceTrace.source_trace_id)) continue
      checkedSourceTraceIds.add(sourceTrace.source_trace_id)
    }

    for (const port of expectedPorts) {
      if (!port.pcb_port_id) continue

      const pads = padMap.get(port.pcb_port_id)

      if (!pads?.length) continue

      let isConnectedByRoutedSourceTrace = false
      const candidateTraces = [
        ...pcbConnectivityMap.getAllTracesConnectedToTrace(trace.pcb_trace_id),
        ...pcbTraces.filter(
          (candidateTrace) =>
            candidateTrace.source_trace_id === sourceTrace?.source_trace_id,
        ),
      ]
      for (const candidateTrace of candidateTraces) {
        if (candidateTrace.pcb_trace_id === trace.pcb_trace_id) continue
        if (!candidateTrace.source_trace_id) continue
        const candidateSourceTrace = sourceTraces.find(
          (st) => st.source_trace_id === candidateTrace.source_trace_id,
        )
        if (
          !sourceTrace ||
          (candidateTrace.source_trace_id !== sourceTrace.source_trace_id &&
            !candidateSourceTrace?.connected_source_port_ids.includes(
              port.source_port_id,
            ))
        ) {
          continue
        }
        const candidateFirstPoint = candidateTrace.route[0]
        const candidateLastPoint = candidateTrace.route.at(-1)
        if (
          getPcbPortIdsConnectedToTrace(candidateTrace).includes(
            port.pcb_port_id,
          ) ||
          (candidateFirstPoint?.route_type === "wire" &&
            pads.some((pad) => isPointInPad(candidateFirstPoint, pad))) ||
          (candidateLastPoint?.route_type === "wire" &&
            pads.some((pad) => isPointInPad(candidateLastPoint, pad)))
        ) {
          isConnectedByRoutedSourceTrace = true
          break
        }
      }
      if (isConnectedByRoutedSourceTrace) continue

      const isFirstPointConnected =
        firstPoint.route_type === "wire" &&
        pads.some((pad) =>
          isPointInPad(
            { x: firstPoint.x, y: firstPoint.y },
            pad,
            firstPoint.layer,
          ),
        )

      const isLastPointConnected =
        lastPoint.route_type === "wire" &&
        pads.some((pad) =>
          isPointInPad(
            { x: lastPoint.x, y: lastPoint.y },
            pad,
            lastPoint.layer,
          ),
        )

      if (!isFirstPointConnected && !isLastPointConnected) {
        const portName = getReadableNameForPcbPort(
          circuitJson,
          port.pcb_port_id,
        ).replace("pcb_port", "")
        const padType = pads[0].type.replace(/pcb_/, "")
        const errorCenter = getMissingConnectionErrorCenter({
          firstPoint,
          lastPoint,
          port,
          expectedPorts,
          padMap,
        })
        errors.push({
          type: "pcb_trace_error",
          message: `Trace [${traceName}] is missing a connection to ${padType}${portName}`,
          source_trace_id:
            sourceTrace?.source_trace_id ||
            trace.source_trace_id ||
            `!${trace.pcb_trace_id}`,
          error_type: "pcb_trace_error",
          pcb_trace_id: trace.pcb_trace_id,
          pcb_trace_error_id: `missing_connection_${trace.pcb_trace_id}_${port.pcb_port_id}`,
          center: errorCenter,
          pcb_component_ids: [],
          pcb_port_ids: [port.pcb_port_id],
        })
      }
    }

    // For net-level traces (no expected ports), check if endpoints are floating
    if (expectedPorts.length === 0) {
      let firstConnectsToAnyPad = false
      let lastConnectsToAnyPad = false
      const endpointsAreSame =
        firstPoint.route_type === "wire" &&
        lastPoint.route_type === "wire" &&
        Math.abs(firstPoint.x - lastPoint.x) < 0.01 &&
        Math.abs(firstPoint.y - lastPoint.y) < 0.01

      for (const pads of padMap.values()) {
        if (
          firstPoint.route_type === "wire" &&
          pads.some((pad) =>
            isPointInPad(
              { x: firstPoint.x, y: firstPoint.y },
              pad,
              firstPoint.layer,
            ),
          )
        ) {
          firstConnectsToAnyPad = true
        }
        if (
          lastPoint.route_type === "wire" &&
          pads.some((pad) =>
            isPointInPad(
              { x: lastPoint.x, y: lastPoint.y },
              pad,
              lastPoint.layer,
            ),
          )
        ) {
          lastConnectsToAnyPad = true
        }
      }

      if (!firstConnectsToAnyPad && firstPoint.route_type === "wire") {
        errors.push({
          type: "pcb_trace_error",
          message: `Trace [${traceName}] has disconnected endpoint at (${firstPoint.x.toFixed(2)}, ${firstPoint.y.toFixed(2)})`,
          source_trace_id:
            sourceTrace?.source_trace_id ||
            trace.source_trace_id ||
            `!${trace.pcb_trace_id}`,
          error_type: "pcb_trace_error",
          pcb_trace_id: trace.pcb_trace_id,
          pcb_trace_error_id: `disconnected_endpoint_${trace.pcb_trace_id}_start`,
          center: { x: firstPoint.x, y: firstPoint.y },
          pcb_component_ids: [],
          pcb_port_ids: [],
        })
      }
      if (
        !lastConnectsToAnyPad &&
        lastPoint.route_type === "wire" &&
        !(endpointsAreSame && !firstConnectsToAnyPad)
      ) {
        errors.push({
          type: "pcb_trace_error",
          message: `Trace [${traceName}] has disconnected endpoint at (${lastPoint.x.toFixed(2)}, ${lastPoint.y.toFixed(2)})`,
          source_trace_id:
            sourceTrace?.source_trace_id ||
            trace.source_trace_id ||
            `!${trace.pcb_trace_id}`,
          error_type: "pcb_trace_error",
          pcb_trace_id: trace.pcb_trace_id,
          pcb_trace_error_id: `disconnected_endpoint_${trace.pcb_trace_id}_end`,
          center: { x: lastPoint.x, y: lastPoint.y },
          pcb_component_ids: [],
          pcb_port_ids: [],
        })
      }
    }
  }

  return errors
}

export { checkTracesAreContiguous }
