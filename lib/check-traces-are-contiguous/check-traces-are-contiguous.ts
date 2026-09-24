import { getMissingConnectionErrorCenter } from "./get-missing-connection-error-center"
import {
  getPhysicallyConnectedTraces,
  createTraceConnectivityContext,
} from "./get-physically-connected-traces"
import {
  routePointTouchesPad,
  type PcbPad,
} from "../util/route-point-touches-pad"
import { createIndexedPcbConnectivityMap } from "lib/util/create-indexed-pcb-connectivity-map"
import type {
  AnyCircuitElement,
  PcbTraceError,
  PcbPort,
  SourceTrace,
} from "circuit-json"
import {
  getReadableNameForPcbPort,
  getReadableNameForPcbTrace,
} from "@tscircuit/circuit-json-util"
import {
  type ConnectivityMap,
  type PcbConnectivityMap,
} from "circuit-json-to-connectivity-map"

type PcbPortId = PcbPort["pcb_port_id"]
type SourceTraceId = SourceTrace["source_trace_id"]

function checkTracesAreContiguous(
  circuitJson: AnyCircuitElement[],
  {
    pcbConnectivityMap,
  }: {
    connMap?: ConnectivityMap
    pcbConnectivityMap?: PcbConnectivityMap
  } = {},
): PcbTraceError[] {
  const errors: PcbTraceError[] = []

  const pcbPorts = circuitJson.filter((el) => el.type === "pcb_port")
  const pcbTraces = circuitJson.filter((el) => el.type === "pcb_trace")
  const sourceTraces = circuitJson.filter((el) => el.type === "source_trace")
  const pcbSmtPads = circuitJson.filter((el) => el.type === "pcb_smtpad")
  const pcbPlatedHoles = circuitJson.filter(
    (el) => el.type === "pcb_plated_hole",
  )

  const padMap = new Map<PcbPortId, PcbPad[]>()
  pcbConnectivityMap ??= createIndexedPcbConnectivityMap(circuitJson)
  const checkedSourceTraceIds = new Set<SourceTraceId>()

  for (const pads of [pcbSmtPads, pcbPlatedHoles]) {
    for (const pad of pads) {
      if (!pad.pcb_port_id) continue
      let portPads = padMap.get(pad.pcb_port_id)
      if (!portPads) {
        portPads = []
        padMap.set(pad.pcb_port_id, portPads)
      }
      portPads.push(pad)
    }
  }

  const traceConnectivity = createTraceConnectivityContext({
    pcbTraces,
    padMap,
    pcbConnectivityMap,
  })

  for (const trace of pcbTraces) {
    if (trace.route.length === 0) continue

    const firstPoint = trace.route[0]
    const lastPoint = trace.route[trace.route.length - 1]

    const sourceTrace = sourceTraces.find(
      (st) => st.source_trace_id === trace.source_trace_id,
    )

    let expectedPorts: PcbPort[] = []
    if (sourceTrace) {
      expectedPorts = pcbPorts.filter((port) =>
        sourceTrace.connected_source_port_ids?.includes(port.source_port_id),
      )
    }

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

      const isConnectedByRoutedSourceTrace = getPhysicallyConnectedTraces(
        trace,
        traceConnectivity,
      ).some((candidateTrace) =>
        traceConnectivity.touchedPortIdsByTraceId
          .get(candidateTrace.pcb_trace_id)
          ?.has(port.pcb_port_id),
      )
      if (isConnectedByRoutedSourceTrace) continue

      const isFirstPointConnected = pads.some((pad) =>
        routePointTouchesPad(firstPoint, pad),
      )

      const isLastPointConnected = pads.some((pad) =>
        routePointTouchesPad(lastPoint, pad),
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
  }

  return errors
}

export { checkTracesAreContiguous }
