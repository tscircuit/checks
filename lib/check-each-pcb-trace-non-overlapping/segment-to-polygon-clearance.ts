import type { PcbPlatedHole, PcbSmtPad } from "circuit-json"
import type { PcbTraceSegment } from "./getCollidableBounds"

export type Point = { x: number; y: number }

type PolygonalPad = PcbSmtPad | PcbPlatedHole

const EPS = 1e-9

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const distanceSquared = (a: Point, b: Point) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2

const rotatePoint = (point: Point, angleDegrees: number): Point => {
  const angle = (angleDegrees * Math.PI) / 180
  return {
    x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
    y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
  }
}

export const getRotatedRectPoints = ({
  x,
  y,
  width,
  height,
  ccwRotation,
}: {
  x: number
  y: number
  width: number
  height: number
  ccwRotation: number
}): Point[] => {
  const halfWidth = width / 2
  const halfHeight = height / 2

  return [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ].map((point) => {
    const rotated = rotatePoint(point, ccwRotation)
    return { x: x + rotated.x, y: y + rotated.y }
  })
}

export const getPolygonPointsForPad = (pad: PolygonalPad): Point[] | null => {
  if (pad.type === "pcb_smtpad") {
    if (pad.shape === "polygon") return pad.points

    if (pad.shape === "rotated_rect") {
      return getRotatedRectPoints({
        x: pad.x,
        y: pad.y,
        width: pad.width,
        height: pad.height,
        ccwRotation: pad.ccw_rotation,
      })
    }
  }

  if (
    pad.type === "pcb_plated_hole" &&
    "rect_pad_width" in pad &&
    "rect_pad_height" in pad
  ) {
    return getRotatedRectPoints({
      x: pad.x,
      y: pad.y,
      width: pad.rect_pad_width,
      height: pad.rect_pad_height,
      ccwRotation:
        "rect_ccw_rotation" in pad && typeof pad.rect_ccw_rotation === "number"
          ? pad.rect_ccw_rotation
          : 0,
    })
  }

  return null
}

const getPolygonEdges = (points: Point[]) =>
  points.map(
    (point, index) => [point, points[(index + 1) % points.length]!] as const,
  )

const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

const isPointOnSegment = (point: Point, start: Point, end: Point) =>
  Math.abs(cross(start, end, point)) <= EPS &&
  point.x >= Math.min(start.x, end.x) - EPS &&
  point.x <= Math.max(start.x, end.x) + EPS &&
  point.y >= Math.min(start.y, end.y) - EPS &&
  point.y <= Math.max(start.y, end.y) + EPS

const getSegmentIntersection = (
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): Point | null => {
  const da = { x: a2.x - a1.x, y: a2.y - a1.y }
  const db = { x: b2.x - b1.x, y: b2.y - b1.y }
  const denominator = da.x * db.y - da.y * db.x

  if (Math.abs(denominator) <= EPS) {
    for (const point of [a1, a2]) {
      if (isPointOnSegment(point, b1, b2)) return point
    }
    for (const point of [b1, b2]) {
      if (isPointOnSegment(point, a1, a2)) return point
    }
    return null
  }

  const delta = { x: b1.x - a1.x, y: b1.y - a1.y }
  const t = (delta.x * db.y - delta.y * db.x) / denominator
  const u = (delta.x * da.y - delta.y * da.x) / denominator

  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null

  return {
    x: a1.x + clamp(t, 0, 1) * da.x,
    y: a1.y + clamp(t, 0, 1) * da.y,
  }
}

const isPointInPolygon = (point: Point, polygon: Point[]) => {
  for (const [start, end] of getPolygonEdges(polygon)) {
    if (isPointOnSegment(point, start, end)) return true
  }

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!
    const pj = polygon[j]!
    const intersects =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x
    if (intersects) inside = !inside
  }
  return inside
}

const closestPointOnSegment = (point: Point, start: Point, end: Point) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= EPS) return start

  const t = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    0,
    1,
  )

  return { x: start.x + t * dx, y: start.y + t * dy }
}

const getClosestPointsBetweenSegments = (
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
) => {
  const intersection = getSegmentIntersection(a1, a2, b1, b2)
  if (intersection) {
    return {
      distance: 0,
      pointOnA: intersection,
      pointOnB: intersection,
      center: intersection,
    }
  }

  const candidates = [
    { pointOnA: a1, pointOnB: closestPointOnSegment(a1, b1, b2) },
    { pointOnA: a2, pointOnB: closestPointOnSegment(a2, b1, b2) },
    { pointOnA: closestPointOnSegment(b1, a1, a2), pointOnB: b1 },
    { pointOnA: closestPointOnSegment(b2, a1, a2), pointOnB: b2 },
  ]

  let best = candidates[0]!
  let bestDistanceSquared = distanceSquared(best.pointOnA, best.pointOnB)
  for (const candidate of candidates.slice(1)) {
    const candidateDistanceSquared = distanceSquared(
      candidate.pointOnA,
      candidate.pointOnB,
    )
    if (candidateDistanceSquared < bestDistanceSquared) {
      best = candidate
      bestDistanceSquared = candidateDistanceSquared
    }
  }

  return {
    distance: Math.sqrt(bestDistanceSquared),
    pointOnA: best.pointOnA,
    pointOnB: best.pointOnB,
    center: {
      x: (best.pointOnA.x + best.pointOnB.x) / 2,
      y: (best.pointOnA.y + best.pointOnB.y) / 2,
    },
  }
}

export const getSegmentToPolygonClearance = (
  segment: PcbTraceSegment,
  polygon: Point[],
) => {
  const start = { x: segment.x1, y: segment.y1 }
  const end = { x: segment.x2, y: segment.y2 }

  if (polygon.length < 3) {
    return { distance: Number.POSITIVE_INFINITY, center: start }
  }

  const intersections = getPolygonEdges(polygon)
    .map(([edgeStart, edgeEnd]) =>
      getSegmentIntersection(start, end, edgeStart, edgeEnd),
    )
    .filter((point): point is Point => point !== null)

  if (intersections.length > 0) {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    intersections.sort((a, b) => {
      const ta = ((a.x - start.x) * dx + (a.y - start.y) * dy) / lengthSquared
      const tb = ((b.x - start.x) * dx + (b.y - start.y) * dy) / lengthSquared
      return ta - tb
    })

    return { distance: 0, center: intersections[0]! }
  }

  if (isPointInPolygon(start, polygon) || isPointInPolygon(end, polygon)) {
    return {
      distance: 0,
      center: {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      },
    }
  }

  let best = getClosestPointsBetweenSegments(
    start,
    end,
    polygon[0]!,
    polygon[1]!,
  )

  for (const [edgeStart, edgeEnd] of getPolygonEdges(polygon).slice(1)) {
    const candidate = getClosestPointsBetweenSegments(
      start,
      end,
      edgeStart,
      edgeEnd,
    )
    if (candidate.distance < best.distance) best = candidate
  }

  return { distance: best.distance, center: best.center }
}
