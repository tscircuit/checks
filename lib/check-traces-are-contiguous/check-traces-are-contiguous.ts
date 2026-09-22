import { createIndexedPcbConnectivityMap } from "lib/util/create-indexed-pcb-connectivity-map"
import type {
  AnyCircuitElement,
  PcbTraceError,
  PcbPort,
  PcbTrace,
  SourceTrace,
  PcbSmtPad,
  PcbPlatedHole,
} from "circuit-json"
import { pointToSegmentDistance } from "@tscircuit/math-utils"
import { isPointInPad } from "./is-point-in-pad"
import { distance } from "../util/distance"
import { getPcbPortIdsConnectedToRoutePoint } from "../check-each-pcb-trace-non-overlapping/getPcbPortIdsConnectedToTraces"
import {
  getReadableNameForPcbPort,
  getReadableNameForPcbTrace,
} from "@tscircuit/circuit-json-util"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
  type PcbConnectivityMap,
} from "circuit-json-to-connectivity-map"
import { getLayersOfPcbElement } from "../util/getLayersOfPcbElement"
import { getPourContactTester } from "./pour-contact-index"
import { endpointTouchesVia, getViaContactIndex } from "./via-contact-index"

type PcbPortId = PcbPort["pcb_port_id"]
type PcbTraceRoutePoint = PcbTrace["route"][number]
type PcbTraceWireRoutePoint = Extract<
  PcbTraceRoutePoint,
  { route_type: "wire" }
>
type PcbPad = PcbSmtPad | PcbPlatedHole

interface TraceWireSegment {
  trace: PcbTrace
  start: PcbTraceWireRoutePoint
  end: PcbTraceWireRoutePoint
  centerlineStart: PcbTraceWireRoutePoint
  centerlineEnd: PcbTraceWireRoutePoint
}

type TraceWireSegmentsByNetAndLayer = Map<
  string,
  Map<string, TraceWireSegment[]>
>

const ENDPOINT_CONTACT_EPSILON = 1e-9
const TRACE_SEGMENT_GEOMETRY_EPSILON = 1e-9

function routePointTouchesPad(point: PcbTraceRoutePoint, pad: PcbPad) {
  return (
    point.route_type === "wire" &&
    getLayersOfPcbElement(pad).includes(point.layer) &&
    isPointInPad(point, pad)
  )
}

function getTraceWireSegmentsByNetAndLayer(
  pcbTraces: PcbTrace[],
  fullConnectivityMap: ConnectivityMap,
): TraceWireSegmentsByNetAndLayer {
  const segmentsByNetAndLayer: TraceWireSegmentsByNetAndLayer = new Map()

  for (const trace of pcbTraces) {
    // Interpolated segments need position-dependent width evaluation. Keep
    // this focused fix conservative until that geometry is available here.
    if (trace.route_thickness_mode === "interpolated") continue

    const netId = fullConnectivityMap.getNetConnectedToId(trace.pcb_trace_id)
    if (!netId) continue

    for (let i = 0; i < trace.route.length - 1; i++) {
      const start = trace.route[i]
      const end = trace.route[i + 1]

      if (start.route_type !== "wire" || end.route_type !== "wire") continue
      if (start.layer !== end.layer) continue
      if (
        Math.hypot(start.x - end.x, start.y - end.y) <=
        TRACE_SEGMENT_GEOMETRY_EPSILON
      ) {
        continue
      }

      const segmentsByLayer = segmentsByNetAndLayer.get(netId) ?? new Map()
      const segments = segmentsByLayer.get(start.layer) ?? []
      // Preserve the physical straight span even if the route subdivides it.
      // Copper width still comes from the original segment's start point.
      let centerlineStart = start
      let centerlineEnd = end
      for (let j = i - 1; j >= 0; j--) {
        const previous = trace.route[j]
        if (
          previous.route_type !== "wire" ||
          previous.layer !== start.layer ||
          pointToSegmentDistance(centerlineStart, previous, centerlineEnd) >
            TRACE_SEGMENT_GEOMETRY_EPSILON
        )
          break
        centerlineStart = previous
      }
      for (let j = i + 2; j < trace.route.length; j++) {
        const next = trace.route[j]
        if (
          next.route_type !== "wire" ||
          next.layer !== start.layer ||
          pointToSegmentDistance(centerlineEnd, centerlineStart, next) >
            TRACE_SEGMENT_GEOMETRY_EPSILON
        )
          break
        centerlineEnd = next
      }
      segments.push({ trace, start, end, centerlineStart, centerlineEnd })
      segmentsByLayer.set(start.layer, segments)
      segmentsByNetAndLayer.set(netId, segmentsByLayer)
    }
  }

  return segmentsByNetAndLayer
}

function getEndpointTraceWireSegment(
  trace: PcbTrace,
  endpoint: "start" | "end",
): Pick<TraceWireSegment, "start" | "end"> | undefined {
  // Interpolated traces have flat longitudinal ends, so a point-radius contact
  // test would overestimate their endpoint copper.
  if (trace.route_thickness_mode === "interpolated") return undefined

  let segmentStartIndex = endpoint === "start" ? 0 : trace.route.length - 2
  const indexStep = endpoint === "start" ? 1 : -1

  while (segmentStartIndex >= 0 && segmentStartIndex < trace.route.length - 1) {
    const segmentStart = trace.route[segmentStartIndex]
    const segmentEnd = trace.route[segmentStartIndex + 1]

    if (
      segmentStart?.route_type !== "wire" ||
      segmentEnd?.route_type !== "wire" ||
      segmentStart.layer !== segmentEnd.layer
    ) {
      return undefined
    }

    if (
      Math.hypot(segmentStart.x - segmentEnd.x, segmentStart.y - segmentEnd.y) >
      TRACE_SEGMENT_GEOMETRY_EPSILON
    ) {
      // A constant-width segment takes its thickness from its start route point.
      return { start: segmentStart, end: segmentEnd }
    }

    segmentStartIndex += indexStep
  }

  return undefined
}

function getEndpointTraceCopperWidth(
  trace: PcbTrace,
  endpoint: "start" | "end",
) {
  return getEndpointTraceWireSegment(trace, endpoint)?.start.width
}

/** Follow a terminal straight centerline in board-world mm (+X right, +Y up).
 * All values are points, in the right-handed XY plane. Subdividing the same
 * copper segment must not change whether its outward endpoint is a branch.
 */
function getEndpointInwardPoint(trace: PcbTrace, endpoint: "start" | "end") {
  const terminalSegment = getEndpointTraceWireSegment(trace, endpoint)
  if (!terminalSegment) return undefined
  const outerPoint =
    endpoint === "start" ? terminalSegment.start : terminalSegment.end
  let inwardPoint =
    endpoint === "start" ? terminalSegment.end : terminalSegment.start
  const step = endpoint === "start" ? 1 : -1
  let routeIndex = trace.route.indexOf(inwardPoint) + step
  while (routeIndex >= 0 && routeIndex < trace.route.length) {
    const nextPoint = trace.route[routeIndex]
    if (nextPoint.route_type !== "wire" || nextPoint.layer !== outerPoint.layer)
      break
    if (
      pointToSegmentDistance(inwardPoint, outerPoint, nextPoint) >
      TRACE_SEGMENT_GEOMETRY_EPSILON
    )
      break
    inwardPoint = nextPoint
    routeIndex += step
  }
  return inwardPoint
}

function routePointTouchesLogicallyConnectedTraceCopper({
  point,
  endpointTraceCopperWidth,
  ownerTrace,
  traceWireSegmentsByNetAndLayer,
  fullConnectivityMap,
}: {
  point: PcbTraceRoutePoint
  endpointTraceCopperWidth: number
  ownerTrace: PcbTrace
  traceWireSegmentsByNetAndLayer: TraceWireSegmentsByNetAndLayer
  fullConnectivityMap: ConnectivityMap
}): boolean {
  if (point.route_type !== "wire") return false

  const ownerNetId = fullConnectivityMap.getNetConnectedToId(
    ownerTrace.pcb_trace_id,
  )
  if (!ownerNetId) return false
  const candidateSegments =
    traceWireSegmentsByNetAndLayer.get(ownerNetId)?.get(point.layer) ?? []

  const endpoint = ownerTrace.route[0] === point ? "start" : "end"
  const inwardNeighbor = getEndpointInwardPoint(ownerTrace, endpoint)

  // Logical connectivity selects the eligible net. Geometry must still prove
  // that this exact endpoint directly touches copper outside its owner trace.
  for (const segment of candidateSegments) {
    if (segment.trace.pcb_trace_id === ownerTrace.pcb_trace_id) continue

    // Copper fully contained in a wider conductor does not form a free spur.
    if (
      pointToSegmentDistance(point, segment.start, segment.end) +
        endpointTraceCopperWidth / 2 <=
      segment.start.width / 2 + ENDPOINT_CONTACT_EPSILON
    )
      return true

    // A short branch can sit inside the rounded copper at its own junction.
    // Contact at the inward neighbor cannot justify its outward, free end.
    if (
      inwardNeighbor?.route_type === "wire" &&
      inwardNeighbor.layer === point.layer &&
      pointToSegmentDistance(
        inwardNeighbor,
        segment.centerlineStart,
        segment.centerlineEnd,
      ) <= TRACE_SEGMENT_GEOMETRY_EPSILON &&
      pointToSegmentDistance(
        point,
        segment.centerlineStart,
        segment.centerlineEnd,
      ) > TRACE_SEGMENT_GEOMETRY_EPSILON
    )
      continue

    const maximumContactDistance =
      endpointTraceCopperWidth / 2 +
      segment.start.width / 2 +
      ENDPOINT_CONTACT_EPSILON
    if (
      pointToSegmentDistance(point, segment.start, segment.end) <=
      maximumContactDistance
    ) {
      return true
    }
  }

  return false
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
  {
    connMap,
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
  let fullConnectivityMap: ConnectivityMap | undefined = connMap
  let traceWireSegmentsByNetAndLayer: TraceWireSegmentsByNetAndLayer | undefined
  const getFullConnectivityMap = () => {
    fullConnectivityMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
    return fullConnectivityMap
  }
  const getTraceWireSegmentIndex = () => {
    traceWireSegmentsByNetAndLayer ??= getTraceWireSegmentsByNetAndLayer(
      pcbTraces,
      getFullConnectivityMap(),
    )
    return traceWireSegmentsByNetAndLayer
  }
  let viaContactIndex: ReturnType<typeof getViaContactIndex> | undefined
  const getViaIndex = () => {
    viaContactIndex ??= getViaContactIndex(
      circuitJson,
      getFullConnectivityMap(),
    )
    return viaContactIndex
  }
  let touchesPour: ReturnType<typeof getPourContactTester> | undefined
  const endpointTouchesPour = (
    point: PcbTraceRoutePoint,
    width: number | undefined,
    trace: PcbTrace,
  ) => {
    if (point.route_type !== "wire" || width === undefined) return false
    const connectivity = getFullConnectivityMap()
    const net = connectivity.getNetConnectedToId(trace.pcb_trace_id)
    if (!net) return false
    touchesPour ??= getPourContactTester(circuitJson, connectivity)
    return touchesPour(net, [point.layer], point, width / 2)
  }
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
    const portsToCheck =
      sourceTrace && checkedSourceTraceIds.has(sourceTrace.source_trace_id)
        ? []
        : expectedPorts
    if (sourceTrace) checkedSourceTraceIds.add(sourceTrace.source_trace_id)

    const errorsBeforePortChecks = errors.length
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

    // Check each fragment even when its expected ports are already connected.
    // Missing-port errors already describe a broken connection on this fragment.
    if (errors.length === errorsBeforePortChecks) {
      let firstConnectsToAnyPad = false
      let lastConnectsToAnyPad = false

      for (const pads of padMap.values()) {
        if (pads.some((pad) => routePointTouchesPad(firstPoint, pad))) {
          firstConnectsToAnyPad = true
        }
        if (pads.some((pad) => routePointTouchesPad(lastPoint, pad))) {
          lastConnectsToAnyPad = true
        }
      }

      const firstEndpointTraceCopperWidth = !firstConnectsToAnyPad
        ? getEndpointTraceCopperWidth(trace, "start")
        : undefined
      const lastEndpointTraceCopperWidth = !lastConnectsToAnyPad
        ? getEndpointTraceCopperWidth(trace, "end")
        : undefined
      const firstConnectsToLogicallyConnectedTraceCopper =
        firstEndpointTraceCopperWidth !== undefined &&
        routePointTouchesLogicallyConnectedTraceCopper({
          point: firstPoint,
          endpointTraceCopperWidth: firstEndpointTraceCopperWidth,
          ownerTrace: trace,
          traceWireSegmentsByNetAndLayer: getTraceWireSegmentIndex(),
          fullConnectivityMap: getFullConnectivityMap(),
        })
      const lastConnectsToLogicallyConnectedTraceCopper =
        lastEndpointTraceCopperWidth !== undefined &&
        routePointTouchesLogicallyConnectedTraceCopper({
          point: lastPoint,
          endpointTraceCopperWidth: lastEndpointTraceCopperWidth,
          ownerTrace: trace,
          traceWireSegmentsByNetAndLayer: getTraceWireSegmentIndex(),
          fullConnectivityMap: getFullConnectivityMap(),
        })
      const firstIsConnected =
        firstConnectsToAnyPad ||
        endpointTouchesPour(firstPoint, firstEndpointTraceCopperWidth, trace) ||
        firstConnectsToLogicallyConnectedTraceCopper ||
        (firstEndpointTraceCopperWidth !== undefined &&
          endpointTouchesVia({
            point: firstPoint,
            width: firstEndpointTraceCopperWidth,
            ownerTrace: trace,
            index: getViaIndex(),
            connectivity: getFullConnectivityMap(),
          }))
      const lastIsConnected =
        lastConnectsToAnyPad ||
        endpointTouchesPour(lastPoint, lastEndpointTraceCopperWidth, trace) ||
        lastConnectsToLogicallyConnectedTraceCopper ||
        (lastEndpointTraceCopperWidth !== undefined &&
          endpointTouchesVia({
            point: lastPoint,
            width: lastEndpointTraceCopperWidth,
            ownerTrace: trace,
            index: getViaIndex(),
            connectivity: getFullConnectivityMap(),
          }))
      const endpointsAreSame =
        firstPoint.route_type === "wire" &&
        lastPoint.route_type === "wire" &&
        firstPoint.layer === lastPoint.layer &&
        Math.hypot(firstPoint.x - lastPoint.x, firstPoint.y - lastPoint.y) <=
          ENDPOINT_CONTACT_EPSILON

      // Port-associated via-only and wire-to-via fragments have no endpoint
      // wire segment. Their connectivity is validated by the port checks above.
      const checkFirstEndpoint =
        expectedPorts.length === 0 ||
        firstEndpointTraceCopperWidth !== undefined
      const checkLastEndpoint =
        expectedPorts.length === 0 || lastEndpointTraceCopperWidth !== undefined

      if (
        checkFirstEndpoint &&
        !firstIsConnected &&
        firstPoint.route_type === "wire"
      ) {
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
        checkLastEndpoint &&
        !lastIsConnected &&
        lastPoint.route_type === "wire" &&
        !(endpointsAreSame && !firstIsConnected)
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
