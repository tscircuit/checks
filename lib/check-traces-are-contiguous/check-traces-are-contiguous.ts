import { createIndexedPcbConnectivityMap } from "../util/create-indexed-pcb-connectivity-map"
import type {
  AnyCircuitElement,
  PcbTraceError,
  PcbPort,
  PcbTrace,
  SourceTrace,
  PcbSmtPad,
  PcbPlatedHole,
} from "circuit-json"
import type {
  ConnectivityMap,
  PcbConnectivityMap,
} from "circuit-json-to-connectivity-map"
import {
  getReadableNameForPcbPort,
  getReadableNameForPcbTrace,
} from "@tscircuit/circuit-json-util"
import { distance } from "../util/distance"
import { getPcbPortIdsConnectedToRoutePoint } from "../check-each-pcb-trace-non-overlapping/getPcbPortIdsConnectedToTraces"
import {
  routePointTouchesPad,
  type PcbPad,
  type PcbTraceRoutePoint,
} from "../util/route-point-touches-pad"

type PcbPortId = PcbPort["pcb_port_id"]
type PcbTraceWireRoutePoint = Extract<
  PcbTraceRoutePoint,
  { route_type: "wire" }
>
const VIA_ALIGNMENT_TOLERANCE_MM = 0.01

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
  padMap: Map<PcbPortId, PcbPad[]>,
) {
  return expectedPorts.some((expectedPort) => {
    if (
      !expectedPort.pcb_port_id ||
      expectedPort.pcb_port_id === missingPcbPortId
    ) {
      return false
    }

    const expectedPads = padMap.get(expectedPort.pcb_port_id)
    return (
      expectedPads?.some((pad) => routePointTouchesPad(point, pad)) ?? false
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
  firstPoint: PcbTraceRoutePoint
  lastPoint: PcbTraceRoutePoint
  port: PcbPort
  expectedPorts: PcbPort[]
  padMap: Map<PcbPortId, PcbPad[]>
}) {
  let errorLocation: PcbTraceWireRoutePoint | undefined
  let firstWirePoint: PcbTraceWireRoutePoint | undefined
  if (firstPoint.route_type === "wire") {
    firstWirePoint = firstPoint
  }
  let lastWirePoint: PcbTraceWireRoutePoint | undefined
  if (lastPoint.route_type === "wire") {
    lastWirePoint = lastPoint
  }
  const firstPointReferencesPort = getPcbPortIdsConnectedToRoutePoint(
    firstPoint,
  ).includes(port.pcb_port_id)
  const lastPointReferencesPort = getPcbPortIdsConnectedToRoutePoint(
    lastPoint,
  ).includes(port.pcb_port_id)

  if (firstPointReferencesPort && firstWirePoint) {
    errorLocation = firstWirePoint
  } else if (lastPointReferencesPort && lastWirePoint) {
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
    if (distance(firstWirePoint, port) <= distance(lastWirePoint, port)) {
      errorLocation = firstWirePoint
    } else {
      errorLocation = lastWirePoint
    }
  } else if (firstWirePoint) {
    errorLocation = firstWirePoint
  } else if (lastWirePoint) {
    errorLocation = lastWirePoint
  }

  if (errorLocation) {
    return { x: errorLocation.x, y: errorLocation.y }
  }

  const firstPointCenter = getRoutePointCenter(firstPoint)
  const lastPointCenter = getRoutePointCenter(lastPoint)
  return {
    x: (firstPointCenter.x + lastPointCenter.x) / 2,
    y: (firstPointCenter.y + lastPointCenter.y) / 2,
  }
}

/** Validates required-port connectivity and alignment at route vias. */
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

  const padMap = new Map<PcbPortId, PcbPad[]>()
  pcbConnectivityMap ??= createIndexedPcbConnectivityMap(circuitJson)
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

  const touchedPortIdsByTraceId = new Map<string, Set<PcbPortId>>()
  const traceIdsByTouchedPortId = new Map<PcbPortId, Set<string>>()

  // Route attribution can change when a logical net is converted into an MST.
  // Record the PCB ports each routed trace physically reaches so contiguity can
  // follow the copper network instead of relying on singular source_trace_ids.
  for (const trace of pcbTraces) {
    const touchedPortIds = new Set<PcbPortId>()
    const firstPoint = trace.route[0]
    const lastPoint = trace.route.at(-1)

    for (const point of [firstPoint, lastPoint]) {
      if (!point) continue

      for (const [pcbPortId, pads] of padMap) {
        if (pads.some((pad) => routePointTouchesPad(point, pad))) {
          touchedPortIds.add(pcbPortId)
        }
      }
    }

    touchedPortIdsByTraceId.set(trace.pcb_trace_id, touchedPortIds)
    for (const pcbPortId of touchedPortIds) {
      const traceIds = traceIdsByTouchedPortId.get(pcbPortId) ?? new Set()
      traceIds.add(trace.pcb_trace_id)
      traceIdsByTouchedPortId.set(pcbPortId, traceIds)
    }
  }

  const physicallyConnectedTracesByTraceId = new Map<string, PcbTrace[]>()
  const getPhysicallyConnectedTraces = (startTrace: PcbTrace): PcbTrace[] => {
    const cached = physicallyConnectedTracesByTraceId.get(
      startTrace.pcb_trace_id,
    )
    if (cached) return cached

    const connectedTraceIds = new Set<string>()
    const pendingTraceIds = [startTrace.pcb_trace_id]

    while (pendingTraceIds.length > 0) {
      const traceId = pendingTraceIds.pop()!
      if (connectedTraceIds.has(traceId)) continue
      connectedTraceIds.add(traceId)

      for (const connectedTrace of pcbConnectivityMap.getAllTracesConnectedToTrace(
        traceId,
      )) {
        if (!connectedTraceIds.has(connectedTrace.pcb_trace_id)) {
          pendingTraceIds.push(connectedTrace.pcb_trace_id)
        }
      }

      for (const pcbPortId of touchedPortIdsByTraceId.get(traceId) ?? []) {
        for (const touchingTraceId of traceIdsByTouchedPortId.get(pcbPortId) ??
          []) {
          if (!connectedTraceIds.has(touchingTraceId)) {
            pendingTraceIds.push(touchingTraceId)
          }
        }
      }
    }

    const connectedTraces = pcbTraces.filter((trace) =>
      connectedTraceIds.has(trace.pcb_trace_id),
    )
    for (const trace of connectedTraces) {
      physicallyConnectedTracesByTraceId.set(
        trace.pcb_trace_id,
        connectedTraces,
      )
    }
    return connectedTraces
  }

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
            Math.abs(prevPoint.x - currentPoint.x) <
              VIA_ALIGNMENT_TOLERANCE_MM &&
            Math.abs(prevPoint.y - currentPoint.y) < VIA_ALIGNMENT_TOLERANCE_MM

          const nextAligned =
            Math.abs(nextPoint.x - currentPoint.x) <
              VIA_ALIGNMENT_TOLERANCE_MM &&
            Math.abs(nextPoint.y - currentPoint.y) < VIA_ALIGNMENT_TOLERANCE_MM

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
    let portsToCheck = expectedPorts
    if (sourceTrace) {
      if (checkedSourceTraceIds.has(sourceTrace.source_trace_id)) {
        portsToCheck = []
      }
      checkedSourceTraceIds.add(sourceTrace.source_trace_id)
    }

    for (const port of portsToCheck) {
      if (!port.pcb_port_id) continue

      const pads = padMap.get(port.pcb_port_id)

      if (!pads?.length) continue

      const isConnectedByRoutedSourceTrace = getPhysicallyConnectedTraces(
        trace,
      ).some((candidateTrace) =>
        touchedPortIdsByTraceId
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
