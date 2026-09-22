import type { ConnectivityNetId, PcbTraceLayer } from "./types"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { pointToSegmentDistance } from "@tscircuit/math-utils"
import {
  getFullConnectivityMapFromCircuitJson,
  type ConnectivityMap,
} from "circuit-json-to-connectivity-map"
import {
  routePointTouchesPad,
  type PcbTraceRoutePoint,
} from "../util/route-point-touches-pad"
import { getPourContactTester } from "./pour-contact-index"
import { endpointTouchesVia, getViaContactIndex } from "./via-contact-index"

type PcbTraceWireRoutePoint = Extract<
  PcbTraceRoutePoint,
  { route_type: "wire" }
>
export type TraceEndpoint = "start" | "end"
interface TraceWireSegment {
  trace: PcbTrace
  // This pair supplies the copper width and distance used for contact.
  start: PcbTraceWireRoutePoint
  end: PcbTraceWireRoutePoint
  // The full straight span keeps subdivision from hiding a branch.
  centerlineStart: PcbTraceWireRoutePoint
  centerlineEnd: PcbTraceWireRoutePoint
}

type TraceWireSegmentsByNetAndLayer = Map<
  ConnectivityNetId,
  Map<PcbTraceLayer, TraceWireSegment[]>
>

const ENDPOINT_CONTACT_EPSILON = 1e-9
const TRACE_SEGMENT_GEOMETRY_EPSILON = 1e-9

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
        ) {
          break
        }
        centerlineStart = previous
      }
      for (let j = i + 2; j < trace.route.length; j++) {
        const next = trace.route[j]
        if (
          next.route_type !== "wire" ||
          next.layer !== start.layer ||
          pointToSegmentDistance(centerlineEnd, centerlineStart, next) >
            TRACE_SEGMENT_GEOMETRY_EPSILON
        ) {
          break
        }
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
  endpoint: TraceEndpoint,
): Pick<TraceWireSegment, "start" | "end"> | undefined {
  // Interpolated traces have flat longitudinal ends, so a point-radius contact
  // test would overestimate their endpoint copper.
  if (trace.route_thickness_mode === "interpolated") return undefined

  let scanIndex = 0
  let scanDirection = 1
  if (endpoint === "end") {
    scanIndex = trace.route.length - 2
    scanDirection = -1
  }

  while (scanIndex >= 0 && scanIndex < trace.route.length - 1) {
    const segmentStart = trace.route[scanIndex]
    const segmentEnd = trace.route[scanIndex + 1]

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

    // Skip duplicate endpoint points; they do not define a wire segment.
    scanIndex += scanDirection
  }

  return undefined
}

function getEndpointTraceCopperWidth(trace: PcbTrace, endpoint: TraceEndpoint) {
  return getEndpointTraceWireSegment(trace, endpoint)?.start.width
}

/** Follow a terminal straight centerline in board-world mm (+X right, +Y up).
 * All values are points, in the right-handed XY plane. Subdividing the same
 * copper segment must not change whether its outward endpoint is a branch.
 */
function getEndpointInwardPoint(trace: PcbTrace, endpoint: TraceEndpoint) {
  const terminalSegment = getEndpointTraceWireSegment(trace, endpoint)
  if (!terminalSegment) return undefined
  let outerPoint = terminalSegment.start
  let inwardPoint = terminalSegment.end
  let step = 1
  if (endpoint === "end") {
    outerPoint = terminalSegment.end
    inwardPoint = terminalSegment.start
    step = -1
  }
  let routeIndex = trace.route.indexOf(inwardPoint) + step
  while (routeIndex >= 0 && routeIndex < trace.route.length) {
    const nextPoint = trace.route[routeIndex]
    if (nextPoint.route_type !== "wire" || nextPoint.layer !== outerPoint.layer)
      break
    if (
      pointToSegmentDistance(inwardPoint, outerPoint, nextPoint) >
      TRACE_SEGMENT_GEOMETRY_EPSILON
    ) {
      break
    }
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

  let endpoint: TraceEndpoint = "end"
  if (ownerTrace.route[0] === point) {
    endpoint = "start"
  }
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
    ) {
      return true
    }

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
    ) {
      continue
    }

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

/** Tests terminal copper in board-world mm (+X right, +Y up, +Z above,
 * right-handed). Route coordinates are points, not directions.
 */
export function createEndpointContactTester(
  circuitJson: AnyCircuitElement[],
  connMap?: ConnectivityMap,
) {
  const pcbTraces = circuitJson.filter(
    (element) => element.type === "pcb_trace",
  )
  const pads = circuitJson
    .filter(
      (element) =>
        element.type === "pcb_smtpad" || element.type === "pcb_plated_hole",
    )
    .filter((pad) => pad.pcb_port_id)
  let fullConnectivityMap = connMap
  function getConnectivity() {
    fullConnectivityMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
    return fullConnectivityMap
  }
  let traceSegments: TraceWireSegmentsByNetAndLayer | undefined
  let viaContacts: ReturnType<typeof getViaContactIndex> | undefined
  let touchesPour: ReturnType<typeof getPourContactTester> | undefined

  return function getEndpointContact(trace: PcbTrace, endpoint: TraceEndpoint) {
    let point = trace.route[0]
    if (endpoint === "end") point = trace.route[trace.route.length - 1]
    const width = getEndpointTraceCopperWidth(trace, endpoint)
    const hasWireSegment = width !== undefined
    if (pads.some((pad) => routePointTouchesPad(point, pad))) {
      return { isConnected: true, hasWireSegment }
    }
    if (point.route_type !== "wire" || width === undefined) {
      return { isConnected: false, hasWireSegment }
    }

    const connectivity = getConnectivity()
    const netId = connectivity.getNetConnectedToId(trace.pcb_trace_id)
    touchesPour ??= getPourContactTester(circuitJson, connectivity)
    if (netId && touchesPour(netId, [point.layer], point, width / 2)) {
      return { isConnected: true, hasWireSegment }
    }

    traceSegments ??= getTraceWireSegmentsByNetAndLayer(pcbTraces, connectivity)
    if (
      routePointTouchesLogicallyConnectedTraceCopper({
        point,
        endpointTraceCopperWidth: width,
        ownerTrace: trace,
        traceWireSegmentsByNetAndLayer: traceSegments,
        fullConnectivityMap: connectivity,
      })
    ) {
      return { isConnected: true, hasWireSegment }
    }

    viaContacts ??= getViaContactIndex(circuitJson, connectivity)
    return {
      isConnected: endpointTouchesVia({
        point,
        width,
        ownerTrace: trace,
        index: viaContacts,
        connectivity,
      }),
      hasWireSegment,
    }
  }
}
