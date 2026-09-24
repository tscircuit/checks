import { CONTACT_EPSILON_MM, type ConnectivityNetId } from "./types"
import type { AnyCircuitElement, LayerRef, PcbTrace } from "circuit-json"
import { pointToSegmentDistance } from "@tscircuit/math-utils"
import {
  getFullConnectivityMapFromCircuitJson,
  type ConnectivityMap,
} from "circuit-json-to-connectivity-map"
import type {
  PcbPad,
  PcbTraceRoutePoint,
} from "../util/route-point-touches-pad"
import { getPourContactTester } from "./pour-contact-index"
import { endpointTouchesVia, getViaContactIndex } from "./via-contact-index"

export type PcbTraceWireRoutePoint = Extract<
  PcbTraceRoutePoint,
  { route_type: "wire" }
>
export type TraceEndpoint = "start" | "end"

/** The first non-zero-length wire segment reached from a trace endpoint. */
export interface TerminalWireSegment {
  /** Constant-width segments take their width from their first route point. */
  width: number
  /** Farthest point of the straight run that leaves the endpoint. */
  inwardPoint: PcbTraceWireRoutePoint
}

interface TraceWireSegment {
  trace: PcbTrace
  start: PcbTraceWireRoutePoint
  end: PcbTraceWireRoutePoint
  // The full straight run keeps route subdivision from hiding a branch.
  centerlineStart: PcbTraceWireRoutePoint
  centerlineEnd: PcbTraceWireRoutePoint
}

type TraceWireSegmentsByNetAndLayer = Map<
  ConnectivityNetId,
  Map<LayerRef, TraceWireSegment[]>
>

export interface EndpointContactContext {
  circuitJson: AnyCircuitElement[]
  portPads: PcbPad[]
  connMap?: ConnectivityMap
  touchesPour?: ReturnType<typeof getPourContactTester>
  traceWireSegmentsByNetAndLayer?: TraceWireSegmentsByNetAndLayer
  viaContactIndex?: ReturnType<typeof getViaContactIndex>
}

/** Walks from `anchorPoint` through `route[fromIndex]` while the route stays straight. */
function getStraightRunEnd({
  route,
  anchorPoint,
  fromIndex,
  step,
}: {
  route: PcbTraceRoutePoint[]
  anchorPoint: PcbTraceWireRoutePoint
  fromIndex: number
  step: 1 | -1
}): PcbTraceWireRoutePoint {
  let runEnd = anchorPoint
  for (let i = fromIndex; i >= 0 && i < route.length; i += step) {
    const nextPoint = route[i]!
    if (
      nextPoint.route_type !== "wire" ||
      nextPoint.layer !== anchorPoint.layer ||
      pointToSegmentDistance(runEnd, anchorPoint, nextPoint) >
        CONTACT_EPSILON_MM
    ) {
      break
    }
    runEnd = nextPoint
  }
  return runEnd
}

export function getTerminalWireSegment(
  trace: PcbTrace,
  endpoint: TraceEndpoint,
): TerminalWireSegment | undefined {
  // Interpolated traces have flat longitudinal ends, so a point-radius contact
  // test would overestimate their endpoint copper.
  if (trace.route_thickness_mode === "interpolated") return undefined

  const { route } = trace
  let outerIndex = 0
  let step: 1 | -1 = 1
  if (endpoint === "end") {
    outerIndex = route.length - 1
    step = -1
  }
  let innerIndex = outerIndex + step
  while (innerIndex >= 0 && innerIndex < route.length) {
    const outerPoint = route[outerIndex]!
    const innerPoint = route[innerIndex]!
    if (
      outerPoint.route_type !== "wire" ||
      innerPoint.route_type !== "wire" ||
      outerPoint.layer !== innerPoint.layer
    ) {
      return undefined
    }
    const isDuplicatePoint =
      Math.hypot(outerPoint.x - innerPoint.x, outerPoint.y - innerPoint.y) <=
      CONTACT_EPSILON_MM
    if (!isDuplicatePoint) {
      let width = outerPoint.width
      if (endpoint === "end") width = innerPoint.width
      const inwardPoint = getStraightRunEnd({
        route,
        anchorPoint: outerPoint,
        fromIndex: innerIndex,
        step,
      })
      return { width, inwardPoint }
    }
    outerIndex = innerIndex
    innerIndex += step
  }
  return undefined
}

/** Walks backward from segment `start`→`end` while the route stays straight. */
function getStraightRunStart({
  route,
  startIndex,
  start,
  end,
}: {
  route: PcbTraceRoutePoint[]
  startIndex: number
  start: PcbTraceWireRoutePoint
  end: PcbTraceWireRoutePoint
}): PcbTraceWireRoutePoint {
  let runStart = start
  for (let i = startIndex - 1; i >= 0; i--) {
    const previousPoint = route[i]!
    if (
      previousPoint.route_type !== "wire" ||
      previousPoint.layer !== end.layer ||
      pointToSegmentDistance(runStart, previousPoint, end) > CONTACT_EPSILON_MM
    ) {
      break
    }
    runStart = previousPoint
  }
  return runStart
}

function getTraceWireSegmentsByNetAndLayer(
  circuitJson: AnyCircuitElement[],
  connMap: ConnectivityMap,
): TraceWireSegmentsByNetAndLayer {
  const segmentsByNetAndLayer: TraceWireSegmentsByNetAndLayer = new Map()

  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace") continue
    // Interpolated segments need position-dependent width evaluation, which
    // this check does not model yet.
    if (trace.route_thickness_mode === "interpolated") continue
    const netId = connMap.getNetConnectedToId(trace.pcb_trace_id)
    if (!netId) continue

    for (let i = 0; i < trace.route.length - 1; i++) {
      const start = trace.route[i]!
      const end = trace.route[i + 1]!
      if (start.route_type !== "wire" || end.route_type !== "wire") continue
      if (start.layer !== end.layer) continue
      if (Math.hypot(start.x - end.x, start.y - end.y) <= CONTACT_EPSILON_MM) {
        continue
      }

      const centerlineStart = getStraightRunStart({
        route: trace.route,
        startIndex: i,
        start,
        end,
      })
      const centerlineEnd = getStraightRunEnd({
        route: trace.route,
        anchorPoint: centerlineStart,
        fromIndex: i + 1,
        step: 1,
      })
      const segmentsByLayer =
        segmentsByNetAndLayer.get(netId) ??
        new Map<LayerRef, TraceWireSegment[]>()
      const segments = segmentsByLayer.get(start.layer) ?? []
      segments.push({ trace, start, end, centerlineStart, centerlineEnd })
      segmentsByLayer.set(start.layer, segments)
      segmentsByNetAndLayer.set(netId, segmentsByLayer)
    }
  }

  return segmentsByNetAndLayer
}

function endpointTouchesTraceSegment({
  point,
  terminalSegment,
  segment,
}: {
  point: PcbTraceWireRoutePoint
  terminalSegment: TerminalWireSegment
  segment: TraceWireSegment
}) {
  const distance = pointToSegmentDistance(point, segment.start, segment.end)
  const endpointRadius = terminalSegment.width / 2
  const segmentRadius = segment.start.width / 2

  // Copper fully contained in a wider conductor does not form a free spur.
  if (distance + endpointRadius <= segmentRadius + CONTACT_EPSILON_MM) {
    return true
  }

  // A short branch can sit inside the rounded copper at its own junction.
  // Contact at the junction cannot justify the branch's free outward end.
  const branchesFromSegment =
    pointToSegmentDistance(
      terminalSegment.inwardPoint,
      segment.centerlineStart,
      segment.centerlineEnd,
    ) <= CONTACT_EPSILON_MM &&
    pointToSegmentDistance(
      point,
      segment.centerlineStart,
      segment.centerlineEnd,
    ) > CONTACT_EPSILON_MM
  if (branchesFromSegment) return false

  return distance <= endpointRadius + segmentRadius + CONTACT_EPSILON_MM
}

export function createEndpointContactContext(
  circuitJson: AnyCircuitElement[],
  connMap?: ConnectivityMap,
): EndpointContactContext {
  const portPads = circuitJson
    .filter(
      (element) =>
        element.type === "pcb_smtpad" || element.type === "pcb_plated_hole",
    )
    .filter((pad) => pad.pcb_port_id)
  return { circuitJson, portPads, connMap }
}

// Contact geometry is built on first need, so boards whose endpoints all touch
// pads never build connectivity, pour, trace, or via indexes.
function getCachedConnMap(ctx: EndpointContactContext) {
  ctx.connMap ??= getFullConnectivityMapFromCircuitJson(ctx.circuitJson)
  return ctx.connMap
}

function getCachedPourContactTester(ctx: EndpointContactContext) {
  ctx.touchesPour ??= getPourContactTester(
    ctx.circuitJson,
    getCachedConnMap(ctx),
  )
  return ctx.touchesPour
}

function getCachedTraceWireSegments(ctx: EndpointContactContext) {
  ctx.traceWireSegmentsByNetAndLayer ??= getTraceWireSegmentsByNetAndLayer(
    ctx.circuitJson,
    getCachedConnMap(ctx),
  )
  return ctx.traceWireSegmentsByNetAndLayer
}

function getCachedViaContactIndex(ctx: EndpointContactContext) {
  ctx.viaContactIndex ??= getViaContactIndex({
    circuitJson: ctx.circuitJson,
    connMap: getCachedConnMap(ctx),
    touchesPour: getCachedPourContactTester(ctx),
  })
  return ctx.viaContactIndex
}

/** Tests whether a wire endpoint touches other same-net copper (board XY, mm). */
export function endpointTouchesNetCopper(
  {
    trace,
    point,
    terminalSegment,
  }: {
    trace: PcbTrace
    point: PcbTraceWireRoutePoint
    terminalSegment: TerminalWireSegment
  },
  ctx: EndpointContactContext,
): boolean {
  const connMap = getCachedConnMap(ctx)
  const netId = connMap.getNetConnectedToId(trace.pcb_trace_id)

  const touchesPour = getCachedPourContactTester(ctx)
  if (
    netId &&
    touchesPour({
      netId,
      layers: [point.layer],
      center: point,
      radius: terminalSegment.width / 2,
    })
  ) {
    return true
  }

  const traceWireSegments = getCachedTraceWireSegments(ctx)
  if (netId) {
    const segments = traceWireSegments.get(netId)?.get(point.layer) ?? []
    const touchesTrace = segments.some(
      (segment) =>
        segment.trace.pcb_trace_id !== trace.pcb_trace_id &&
        endpointTouchesTraceSegment({ point, terminalSegment, segment }),
    )
    if (touchesTrace) return true
  }

  return endpointTouchesVia(
    { trace, point, width: terminalSegment.width },
    { connMap, viaContactIndex: getCachedViaContactIndex(ctx) },
  )
}
