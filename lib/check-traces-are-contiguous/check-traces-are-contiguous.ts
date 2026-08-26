import type {
  AnyCircuitElement,
  PcbTraceError,
  PcbPort,
  PcbTrace,
  SourceTrace,
  PcbSmtPad,
  PcbPlatedHole,
  SourceNet,
  PcbBreakoutPoint,
} from "circuit-json"
import { isPointInPad } from "./is-point-in-pad"
import { distance } from "../util/distance"
import { getPcbPortIdsConnectedToRoutePoint } from "../check-each-pcb-trace-non-overlapping/getPcbPortIdsConnectedToTraces"
import {
  getReadableNameForPcbPort,
  getReadableNameForPcbTrace,
} from "@tscircuit/circuit-json-util"
import { PcbConnectivityMap } from "circuit-json-to-connectivity-map"
import { getLayersOfPcbElement } from "../util/getLayersOfPcbElement"

type PcbPortId = PcbPort["pcb_port_id"]
type PcbTraceRoutePoint = PcbTrace["route"][number]
type PcbPad = PcbSmtPad | PcbPlatedHole
type BreakoutTouchKey = `${PcbBreakoutPoint["pcb_breakout_point_id"]}:${string}`

const BREAKOUT_POINT_COORDINATE_TOLERANCE = 0.001

function routePointTouchesPad(point: PcbTraceRoutePoint, pad: PcbPad) {
  return (
    point.route_type === "wire" &&
    getLayersOfPcbElement(pad).includes(point.layer) &&
    isPointInPad(point, pad)
  )
}

function getBreakoutTouchKey(
  point: PcbTraceRoutePoint,
  breakoutPoint: PcbBreakoutPoint,
): BreakoutTouchKey | undefined {
  if (point.route_type !== "wire") return undefined

  const reachesBreakoutPoint =
    distance(point, breakoutPoint) <=
    point.width / 2 + BREAKOUT_POINT_COORDINATE_TOLERANCE
  if (!reachesBreakoutPoint) return undefined

  return `${breakoutPoint.pcb_breakout_point_id}:${point.layer}`
}

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
  firstPoint: PcbTrace["route"][number]
  lastPoint: PcbTrace["route"][number]
  port: PcbPort
  expectedPorts: PcbPort[]
  padMap: Map<PcbPortId, PcbPad[]>
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
  const pcbTraceById = new Map(
    pcbTraces.map((pcbTrace) => [pcbTrace.pcb_trace_id, pcbTrace]),
  )
  const sourceTraces = circuitJson.filter(
    (el) => el.type === "source_trace",
  ) as SourceTrace[]
  const sourceNets = circuitJson.filter(
    (el) => el.type === "source_net",
  ) as SourceNet[]
  const pcbSmtPads = circuitJson.filter(
    (el) => el.type === "pcb_smtpad",
  ) as PcbSmtPad[]
  const pcbPlatedHoles = circuitJson.filter(
    (el) => el.type === "pcb_plated_hole",
  ) as PcbPlatedHole[]
  const pcbBreakoutPoints = circuitJson.filter(
    (el) => el.type === "pcb_breakout_point",
  ) as PcbBreakoutPoint[]

  const padMap = new Map<PcbPortId, PcbPad[]>()
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

  const touchedPortIdsByTraceId = new Map<string, Set<PcbPortId>>()
  const traceIdsByTouchedPortId = new Map<PcbPortId, Set<string>>()
  const breakoutTouchKeysByTraceId = new Map<string, Set<BreakoutTouchKey>>()
  const traceIdsByBreakoutTouchKey = new Map<BreakoutTouchKey, Set<string>>()

  // Route attribution can change when a logical net is converted into an MST.
  // Record the PCB ports each routed trace physically reaches so contiguity can
  // follow the copper network instead of relying on singular source_trace_ids.
  for (const trace of pcbTraces) {
    const touchedPortIds = new Set<PcbPortId>()
    const breakoutTouchKeys = new Set<BreakoutTouchKey>()
    const firstPoint = trace.route[0]
    const lastPoint = trace.route.at(-1)

    for (const point of [firstPoint, lastPoint]) {
      if (!point) continue

      for (const [pcbPortId, pads] of padMap) {
        if (pads.some((pad) => routePointTouchesPad(point, pad))) {
          touchedPortIds.add(pcbPortId)
        }
      }

      for (const breakoutPoint of pcbBreakoutPoints) {
        const breakoutTouchKey = getBreakoutTouchKey(point, breakoutPoint)
        if (breakoutTouchKey) breakoutTouchKeys.add(breakoutTouchKey)
      }
    }

    touchedPortIdsByTraceId.set(trace.pcb_trace_id, touchedPortIds)
    for (const pcbPortId of touchedPortIds) {
      const traceIds = traceIdsByTouchedPortId.get(pcbPortId) ?? new Set()
      traceIds.add(trace.pcb_trace_id)
      traceIdsByTouchedPortId.set(pcbPortId, traceIds)
    }

    breakoutTouchKeysByTraceId.set(trace.pcb_trace_id, breakoutTouchKeys)
    for (const breakoutTouchKey of breakoutTouchKeys) {
      const traceIds =
        traceIdsByBreakoutTouchKey.get(breakoutTouchKey) ?? new Set()
      traceIds.add(trace.pcb_trace_id)
      traceIdsByBreakoutTouchKey.set(breakoutTouchKey, traceIds)
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

      for (const breakoutTouchKey of breakoutTouchKeysByTraceId.get(traceId) ??
        []) {
        for (const touchingTraceId of traceIdsByBreakoutTouchKey.get(
          breakoutTouchKey,
        ) ?? []) {
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
        if (pads.some((pad) => routePointTouchesPad(firstPoint, pad))) {
          firstConnectsToAnyPad = true
        }
        if (pads.some((pad) => routePointTouchesPad(lastPoint, pad))) {
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

  // A named source net is usually routed as several one-port source traces.
  // Checking each source trace independently only proves that every port
  // reaches some copper, not that all of that copper belongs to one physical
  // component. Compare the physical component reached by every required port
  // so a net split into independently contiguous islands is still reported.
  for (const sourceNet of sourceNets) {
    // The connectivity map currently models traces, pads, and vias, but not
    // copper pours or ground-plane regions. Avoid a false open until those
    // copper shapes participate in physical-connectivity analysis.
    const hasUnmodeledPlaneCopper = circuitJson.some(
      (element) =>
        (element.type === "pcb_copper_pour" ||
          element.type === "pcb_ground_plane") &&
        element.source_net_id === sourceNet.source_net_id,
    )
    if (hasUnmodeledPlaneCopper) continue

    const sourceTracesForNet = sourceTraces.filter((sourceTrace) =>
      sourceTrace.connected_source_net_ids?.includes(sourceNet.source_net_id),
    )
    const sourceTraceIdsForNet = new Set(
      sourceTracesForNet.map((sourceTrace) => sourceTrace.source_trace_id),
    )
    const expectedSourcePortIds = new Set(
      sourceTracesForNet.flatMap(
        (sourceTrace) => sourceTrace.connected_source_port_ids ?? [],
      ),
    )
    const expectedPorts = pcbPorts.filter((pcbPort) =>
      expectedSourcePortIds.has(pcbPort.source_port_id),
    )

    if (expectedPorts.length < 2) continue

    const routedTracesForNet = pcbTraces.filter(
      (pcbTrace) =>
        pcbTrace.source_trace_id === sourceNet.source_net_id ||
        (pcbTrace.source_trace_id !== undefined &&
          sourceTraceIdsForNet.has(pcbTrace.source_trace_id)),
    )
    if (routedTracesForNet.length === 0) continue

    const routedTraceIdsForNet = new Set(
      routedTracesForNet.map((pcbTrace) => pcbTrace.pcb_trace_id),
    )
    const portsByPhysicalGroup = new Map<string, PcbPort[]>()

    for (const port of expectedPorts) {
      const touchingTraceIds = Array.from(
        traceIdsByTouchedPortId.get(port.pcb_port_id) ?? [],
      )
      // Prefer this net's own trace, but allow copper whose source attribution
      // belongs to a nested circuit. Breakout routing deliberately connects a
      // child trace to a parent trace while each keeps its local source net.
      const touchingTraceId =
        touchingTraceIds.find((traceId) => routedTraceIdsForNet.has(traceId)) ??
        touchingTraceIds.find((traceId) =>
          Array.from(breakoutTouchKeysByTraceId.get(traceId) ?? []).some(
            (breakoutTouchKey) =>
              Array.from(
                traceIdsByBreakoutTouchKey.get(breakoutTouchKey) ?? [],
              ).some((otherTraceId) => routedTraceIdsForNet.has(otherTraceId)),
          ),
        )

      let physicalGroupId = `unconnected_${port.pcb_port_id}`
      if (touchingTraceId) {
        const touchingTrace = pcbTraceById.get(touchingTraceId)
        if (touchingTrace) {
          physicalGroupId =
            getPhysicallyConnectedTraces(touchingTrace)
              .map((pcbTrace) => pcbTrace.pcb_trace_id)
              .sort()[0] ?? touchingTraceId
        }
      }

      portsByPhysicalGroup.set(physicalGroupId, [
        ...(portsByPhysicalGroup.get(physicalGroupId) ?? []),
        port,
      ])
    }

    if (portsByPhysicalGroup.size <= 1) continue

    const disconnectedGroups = Array.from(portsByPhysicalGroup.values()).sort(
      (groupA, groupB) => groupB.length - groupA.length,
    )
    const errorGroup = disconnectedGroups[1] ?? disconnectedGroups[0]!
    const errorCenter = {
      x: errorGroup.reduce((sum, port) => sum + port.x, 0) / errorGroup.length,
      y: errorGroup.reduce((sum, port) => sum + port.y, 0) / errorGroup.length,
    }
    const primaryTrace = routedTracesForNet[0]!

    errors.push({
      type: "pcb_trace_error",
      message: `Net [${sourceNet.name || "unnamed net"}] has ${expectedPorts.length} required PCB ports split across ${portsByPhysicalGroup.size} disconnected copper groups.`,
      source_trace_id: sourceNet.source_net_id,
      error_type: "pcb_trace_error",
      pcb_trace_id: primaryTrace.pcb_trace_id,
      pcb_trace_error_id: `disconnected_copper_groups_${sourceNet.source_net_id}`,
      center: errorCenter,
      pcb_component_ids: Array.from(
        new Set(
          expectedPorts
            .map((port) => port.pcb_component_id)
            .filter((id): id is string => id !== undefined),
        ),
      ),
      pcb_port_ids: expectedPorts.map((port) => port.pcb_port_id),
      subcircuit_id: primaryTrace.subcircuit_id ?? sourceNet.subcircuit_id,
    })
  }

  return errors
}

export { checkTracesAreContiguous }
