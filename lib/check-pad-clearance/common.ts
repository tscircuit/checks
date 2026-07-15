import {
  cju,
  distanceBetweenCircleAndCircle,
  distanceBetweenCircleAndPolygon,
  distanceBetweenPolygonAndPolygon,
  getBoundsOfPcbElements,
} from "@tscircuit/circuit-json-util"
import {
  midpoint,
  pointToSegmentClosestPoint,
  segmentToCircleMinDistance,
  segmentToSegmentMinDistance,
} from "@tscircuit/math-utils"
import type {
  AnyCircuitElement,
  PcbPlatedHole,
  PcbSmtPad,
  PcbTrace,
  PcbVia,
} from "circuit-json"
import type { PcbTraceSegment } from "lib/check-each-pcb-trace-non-overlapping/getCollidableBounds"
import {
  getPillCenterLineForPad,
  getPolygonPointsForPad,
  getSegmentToPillClearance,
  getSegmentToPolygonClearanceFromPoints,
} from "lib/check-each-pcb-trace-non-overlapping/segment-to-polygon-clearance"
import type { Bounds } from "lib/data-structures/SpatialIndex"
import { DEFAULT_TRACE_THICKNESS } from "lib/drc-defaults"

export type PadElement = PcbSmtPad | PcbPlatedHole

export const formatMm = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000
  return `${Number(rounded.toFixed(3))}mm`
}

export const getPadBounds = (pad: PadElement): Bounds =>
  getBoundsOfPcbElements([pad])

export const getPadCenter = (pad: PadElement) => {
  const bounds = getPadBounds(pad)
  return midpoint(
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
  )
}

export const getPadRadius = (pad: PadElement) => {
  const bounds = getPadBounds(pad)
  return Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2
}

export const isCircularPad = (pad: PadElement) => pad.shape === "circle"

const isPillPad = (
  pad: PadElement,
): pad is Extract<PcbSmtPad, { shape: "pill" | "rotated_pill" }> =>
  pad.type === "pcb_smtpad" &&
  (pad.shape === "pill" || pad.shape === "rotated_pill")

const getCircleShape = (pad: PadElement) => {
  const center = getPadCenter(pad)
  return {
    kind: "circle" as const,
    x: center.x,
    y: center.y,
    radius: getPadRadius(pad),
  }
}

const getPolygonShape = (pad: PadElement) => {
  if (
    pad.type === "pcb_smtpad" &&
    (pad.shape === "polygon" || pad.shape === "rotated_rect")
  ) {
    return {
      kind: "polygon" as const,
      points: getPolygonPointsForPad(pad),
    }
  }

  if (
    pad.type === "pcb_plated_hole" &&
    "rect_pad_width" in pad &&
    "rect_pad_height" in pad
  ) {
    return {
      kind: "polygon" as const,
      points: getPolygonPointsForPad(pad),
    }
  }

  const bounds = getPadBounds(pad)
  return {
    kind: "polygon" as const,
    points: [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
    ],
  }
}

export const getPadToPadGap = (padA: PadElement, padB: PadElement) => {
  if (isPillPad(padA) && isPillPad(padB)) {
    const pillA = getPillCenterLineForPad(padA)
    const pillB = getPillCenterLineForPad(padB)
    return (
      segmentToSegmentMinDistance(
        pillA.start,
        pillA.end,
        pillB.start,
        pillB.end,
      ) -
      pillA.radius -
      pillB.radius
    )
  }

  if (isPillPad(padA) && isCircularPad(padB)) {
    const pill = getPillCenterLineForPad(padA)
    return (
      segmentToCircleMinDistance(pill.start, pill.end, getCircleShape(padB)) -
      pill.radius
    )
  }

  if (isCircularPad(padA) && isPillPad(padB)) {
    const pill = getPillCenterLineForPad(padB)
    return (
      segmentToCircleMinDistance(pill.start, pill.end, getCircleShape(padA)) -
      pill.radius
    )
  }

  if (isPillPad(padA)) {
    const pill = getPillCenterLineForPad(padA)
    return (
      getSegmentToPolygonClearanceFromPoints(
        pill.start,
        pill.end,
        getPolygonShape(padB).points,
      ).distance - pill.radius
    )
  }

  if (isPillPad(padB)) {
    const pill = getPillCenterLineForPad(padB)
    return (
      getSegmentToPolygonClearanceFromPoints(
        pill.start,
        pill.end,
        getPolygonShape(padA).points,
      ).distance - pill.radius
    )
  }

  if (isCircularPad(padA) && isCircularPad(padB)) {
    return distanceBetweenCircleAndCircle(
      getCircleShape(padA),
      getCircleShape(padB),
    )
  }

  if (isCircularPad(padA)) {
    return distanceBetweenCircleAndPolygon(
      getCircleShape(padA),
      getPolygonShape(padB),
    )
  }

  if (isCircularPad(padB)) {
    return distanceBetweenCircleAndPolygon(
      getCircleShape(padB),
      getPolygonShape(padA),
    )
  }

  return distanceBetweenPolygonAndPolygon(
    getPolygonShape(padA),
    getPolygonShape(padB),
  )
}

export const getPads = (circuitJson: AnyCircuitElement[]) =>
  [
    ...cju(circuitJson).pcb_smtpad.list(),
    ...cju(circuitJson).pcb_plated_hole.list(),
  ] as PadElement[]

export const getTraceSegments = (
  circuitJson: AnyCircuitElement[],
): PcbTraceSegment[] => {
  const pcbTraces = cju(circuitJson).pcb_trace.list()

  return pcbTraces.flatMap((pcbTrace) => {
    const segments: PcbTraceSegment[] = []

    for (let i = 0; i < pcbTrace.route.length - 1; i++) {
      const p1 = pcbTrace.route[i]
      const p2 = pcbTrace.route[i + 1]
      if (p1.route_type !== "wire") continue
      if (p2.route_type !== "wire") continue
      if (p1.layer !== p2.layer) continue

      segments.push({
        type: "pcb_trace_segment",
        pcb_trace_id: pcbTrace.pcb_trace_id,
        _pcbTrace: pcbTrace as PcbTrace,
        thickness:
          "width" in p1
            ? p1.width
            : "width" in p2
              ? p2.width
              : DEFAULT_TRACE_THICKNESS!,
        layer: p1.layer,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
      })
    }

    return segments
  })
}

export type TraceClearanceObstacle = PadElement | PcbVia

const getCenterBetweenCopperEdges = ({
  tracePoint,
  obstaclePoint,
  traceRadius,
  obstacleRadius,
}: {
  tracePoint: { x: number; y: number }
  obstaclePoint: { x: number; y: number }
  traceRadius: number
  obstacleRadius: number
}) => {
  const dx = obstaclePoint.x - tracePoint.x
  const dy = obstaclePoint.y - tracePoint.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return midpoint(tracePoint, obstaclePoint)

  const unitX = dx / distance
  const unitY = dy / distance
  const traceEdge = {
    x: tracePoint.x + unitX * traceRadius,
    y: tracePoint.y + unitY * traceRadius,
  }
  const obstacleEdge = {
    x: obstaclePoint.x - unitX * obstacleRadius,
    y: obstaclePoint.y - unitY * obstacleRadius,
  }

  return midpoint(traceEdge, obstacleEdge)
}

export const getTraceObstacleClearance = (
  segment: PcbTraceSegment,
  obstacle: TraceClearanceObstacle,
): { gap: number; center: { x: number; y: number } } => {
  const start = { x: segment.x1, y: segment.y1 }
  const end = { x: segment.x2, y: segment.y2 }
  const traceRadius = segment.thickness / 2

  if (obstacle.type === "pcb_via" || isCircularPad(obstacle)) {
    const circle =
      obstacle.type === "pcb_via"
        ? {
            x: obstacle.x,
            y: obstacle.y,
            radius: obstacle.outer_diameter / 2,
          }
        : getCircleShape(obstacle)
    const closestPoint = pointToSegmentClosestPoint(circle, start, end)

    return {
      gap: segmentToCircleMinDistance(start, end, circle) - traceRadius,
      center: getCenterBetweenCopperEdges({
        tracePoint: closestPoint,
        obstaclePoint: circle,
        traceRadius,
        obstacleRadius: circle.radius,
      }),
    }
  }

  if (isPillPad(obstacle)) {
    const clearance = getSegmentToPillClearance(segment, obstacle)
    return {
      gap: clearance.distance - traceRadius - clearance.radius,
      center: getCenterBetweenCopperEdges({
        tracePoint: clearance.tracePoint,
        obstaclePoint: clearance.obstaclePoint,
        traceRadius,
        obstacleRadius: clearance.radius,
      }),
    }
  }

  const clearance = getSegmentToPolygonClearanceFromPoints(
    start,
    end,
    getPolygonShape(obstacle).points,
  )
  return {
    gap: clearance.distance - traceRadius,
    center: getCenterBetweenCopperEdges({
      tracePoint: clearance.tracePoint,
      obstaclePoint: clearance.obstaclePoint,
      traceRadius,
      obstacleRadius: 0,
    }),
  }
}

export const isTraceObstacleOverlap = (gap: number): boolean => gap <= 0
