import {
  doSegmentsIntersect,
  pointToSegmentDistance,
  segmentToSegmentMinDistance,
} from "@tscircuit/math-utils"
import type { PcbPlatedHole, PcbVia } from "circuit-json"

type Point = { x: number; y: number }

/**
 * A segment swept by a disc. A circle is a capsule whose segment is a single
 * point; a pill/stadium is a capsule along its long axis.
 */
export interface Capsule {
  a: Point
  b: Point
  radius: number
}

/**
 * Copper pad outline: either a capsule (circle, pill, oval) or a polygon swept
 * by a disc of `radius` (a plain polygon/rect when radius is 0, a rounded rect
 * otherwise).
 */
export type PadOutline =
  | { kind: "capsule"; capsule: Capsule }
  | { kind: "polygon"; points: Point[]; radius: number }

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const rotate = (point: Point, ccwDegrees: number): Point => {
  if (!ccwDegrees) return point
  const radians = (ccwDegrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}

const translate = (point: Point, center: Point): Point => ({
  x: point.x + center.x,
  y: point.y + center.y,
})

/** A width x height stadium whose long axis follows the larger dimension. */
const getStadiumCapsule = (
  center: Point,
  width: number,
  height: number,
  ccwDegrees = 0,
): Capsule => {
  const radius = Math.min(width, height) / 2
  const halfLength = Math.abs(width - height) / 2
  const axis =
    width >= height ? { x: halfLength, y: 0 } : { x: 0, y: halfLength }
  const offset = rotate(axis, ccwDegrees)
  return {
    a: { x: center.x - offset.x, y: center.y - offset.y },
    b: { x: center.x + offset.x, y: center.y + offset.y },
    radius,
  }
}

const getRectOutline = (
  center: Point,
  width: number,
  height: number,
  ccwDegrees = 0,
  borderRadius = 0,
): PadOutline => {
  const radius = Math.max(0, Math.min(borderRadius, width / 2, height / 2))
  const halfWidth = width / 2 - radius
  const halfHeight = height / 2 - radius
  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ]
  return {
    kind: "polygon",
    points: corners.map((corner) =>
      translate(rotate(corner, ccwDegrees), center),
    ),
    radius,
  }
}

/**
 * Hole and pad geometry for a plated hole, matching how the Gerber/Excellon
 * export places them: the hole sits at (x + hole_offset_x, y + hole_offset_y)
 * in board coordinates, slot holes use hole_ccw_rotation ?? ccw_rotation, and
 * polygon pad outlines are relative to (x, y).
 *
 * Returns null when the element doesn't carry the dimensions needed.
 */
export const getPlatedHoleRingGeometry = (
  platedHole: PcbPlatedHole,
): { hole: Capsule; pad: PadOutline } | null => {
  const center = { x: platedHole.x, y: platedHole.y }
  const holeCenter = {
    x:
      center.x +
      ("hole_offset_x" in platedHole && finite(platedHole.hole_offset_x)
        ? platedHole.hole_offset_x
        : 0),
    y:
      center.y +
      ("hole_offset_y" in platedHole && finite(platedHole.hole_offset_y)
        ? platedHole.hole_offset_y
        : 0),
  }
  const holeRotation =
    ("hole_ccw_rotation" in platedHole && finite(platedHole.hole_ccw_rotation)
      ? platedHole.hole_ccw_rotation
      : undefined) ??
    ("ccw_rotation" in platedHole && finite(platedHole.ccw_rotation)
      ? platedHole.ccw_rotation
      : 0)

  switch (platedHole.shape) {
    case "circle": {
      if (
        !finite(platedHole.hole_diameter) ||
        !finite(platedHole.outer_diameter)
      )
        return null
      return {
        hole: {
          a: holeCenter,
          b: holeCenter,
          radius: platedHole.hole_diameter / 2,
        },
        pad: {
          kind: "capsule",
          capsule: {
            a: center,
            b: center,
            radius: platedHole.outer_diameter / 2,
          },
        },
      }
    }
    case "oval":
    case "pill": {
      const { hole_width, hole_height, outer_width, outer_height } = platedHole
      if (
        !finite(hole_width) ||
        !finite(hole_height) ||
        !finite(outer_width) ||
        !finite(outer_height)
      )
        return null
      return {
        hole: getStadiumCapsule(
          holeCenter,
          hole_width,
          hole_height,
          holeRotation,
        ),
        pad: {
          kind: "capsule",
          capsule: getStadiumCapsule(
            center,
            outer_width,
            outer_height,
            finite(platedHole.ccw_rotation) ? platedHole.ccw_rotation : 0,
          ),
        },
      }
    }
    case "circular_hole_with_rect_pad": {
      const { hole_diameter, rect_pad_width, rect_pad_height } = platedHole
      if (
        !finite(hole_diameter) ||
        !finite(rect_pad_width) ||
        !finite(rect_pad_height)
      )
        return null
      return {
        hole: { a: holeCenter, b: holeCenter, radius: hole_diameter / 2 },
        pad: getRectOutline(
          center,
          rect_pad_width,
          rect_pad_height,
          platedHole.rect_ccw_rotation ?? 0,
          platedHole.rect_border_radius ?? 0,
        ),
      }
    }
    case "pill_hole_with_rect_pad":
    case "rotated_pill_hole_with_rect_pad": {
      const { hole_width, hole_height, rect_pad_width, rect_pad_height } =
        platedHole
      if (
        !finite(hole_width) ||
        !finite(hole_height) ||
        !finite(rect_pad_width) ||
        !finite(rect_pad_height)
      )
        return null
      return {
        hole: getStadiumCapsule(
          holeCenter,
          hole_width,
          hole_height,
          holeRotation,
        ),
        pad: getRectOutline(
          center,
          rect_pad_width,
          rect_pad_height,
          platedHole.shape === "rotated_pill_hole_with_rect_pad"
            ? platedHole.rect_ccw_rotation
            : 0,
          platedHole.rect_border_radius ?? 0,
        ),
      }
    }
    case "hole_with_polygon_pad": {
      const outline = platedHole.pad_outline
      if (
        !outline ||
        outline.length < 3 ||
        !outline.every((point) => finite(point.x) && finite(point.y))
      )
        return null
      let hole: Capsule
      if (platedHole.hole_shape === "circle") {
        if (!finite(platedHole.hole_diameter)) return null
        hole = {
          a: holeCenter,
          b: holeCenter,
          radius: platedHole.hole_diameter / 2,
        }
      } else {
        if (!finite(platedHole.hole_width) || !finite(platedHole.hole_height))
          return null
        hole = getStadiumCapsule(
          holeCenter,
          platedHole.hole_width,
          platedHole.hole_height,
          holeRotation,
        )
      }
      return {
        hole,
        pad: {
          kind: "polygon",
          points: outline.map((point) => translate(point, center)),
          radius: 0,
        },
      }
    }
    default:
      return null
  }
}

export const getViaRingGeometry = (
  via: PcbVia,
): { hole: Capsule; pad: PadOutline } => {
  const center = { x: via.x, y: via.y }
  return {
    hole: { a: center, b: center, radius: via.hole_diameter / 2 },
    pad: {
      kind: "capsule",
      capsule: { a: center, b: center, radius: via.outer_diameter / 2 },
    },
  }
}

const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if (a.y > point.y === b.y > point.y) continue
    const x = a.x + ((point.y - a.y) * (b.x - a.x)) / (b.y - a.y)
    if (x > point.x) inside = !inside
  }
  return inside
}

/**
 * Signed distance from the segment a-b to a polygon's boundary: the smallest
 * boundary distance when the whole segment is inside, otherwise <= 0.
 */
const getSegmentClearanceInsidePolygon = (
  a: Point,
  b: Point,
  polygon: Point[],
): number => {
  let minDistance = Number.POSITIVE_INFINITY
  let crossesBoundary = false
  for (let i = 0; i < polygon.length; i++) {
    const u = polygon[i]
    const v = polygon[(i + 1) % polygon.length]
    minDistance = Math.min(minDistance, segmentToSegmentMinDistance(a, b, u, v))
    if (doSegmentsIntersect(a, b, u, v)) crossesBoundary = true
  }
  const aInside = isPointInPolygon(a, polygon)
  const bInside = isPointInPolygon(b, polygon)
  if (!crossesBoundary && aInside && bInside) return minDistance

  const getSignedPointDistance = (point: Point, inside: boolean) => {
    let distance = Number.POSITIVE_INFINITY
    for (let i = 0; i < polygon.length; i++) {
      distance = Math.min(
        distance,
        pointToSegmentDistance(
          point,
          polygon[i],
          polygon[(i + 1) % polygon.length],
        ),
      )
    }
    return inside ? distance : -distance
  }
  return Math.min(
    0,
    getSignedPointDistance(a, aInside),
    getSignedPointDistance(b, bInside),
  )
}

/**
 * Narrowest copper between the drill wall and the pad edge, in mm. Zero or
 * negative means the drill touches or breaks out of the pad.
 *
 * For a pad that is a capsule or a convex polygon this is exact: the signed
 * distance to a convex outline is concave, so its minimum over the hole's
 * centre segment is at one of the segment's ends.
 */
export const getAnnularRing = (hole: Capsule, pad: PadOutline): number => {
  if (pad.kind === "capsule") {
    const { a, b, radius } = pad.capsule
    const farthestHoleCore = Math.max(
      pointToSegmentDistance(hole.a, a, b),
      pointToSegmentDistance(hole.b, a, b),
    )
    return radius - farthestHoleCore - hole.radius
  }
  return (
    pad.radius +
    getSegmentClearanceInsidePolygon(hole.a, hole.b, pad.points) -
    hole.radius
  )
}
