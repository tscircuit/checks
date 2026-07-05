import type { PcbSmtPad, PcbPlatedHole } from "circuit-json"
import { pointToSegmentDistance } from "@tscircuit/math-utils"
import { getPillCenterLineForPad } from "lib/check-each-pcb-trace-non-overlapping/segment-to-polygon-clearance"

function getDistanceBetweenPoints(
  pointA: { x: number; y: number },
  pointB: { x: number; y: number },
): number {
  return Math.sqrt((pointB.x - pointA.x) ** 2 + (pointB.y - pointA.y) ** 2)
}

const POINT_ON_SEGMENT_TOLERANCE_MM = 1e-9

function isPointOnSegment(
  point: { x: number; y: number },
  segment: { start: { x: number; y: number }; end: { x: number; y: number } },
) {
  const crossProduct =
    (point.y - segment.start.y) * (segment.end.x - segment.start.x) -
    (point.x - segment.start.x) * (segment.end.y - segment.start.y)
  if (Math.abs(crossProduct) > POINT_ON_SEGMENT_TOLERANCE_MM) return false

  const dotProduct =
    (point.x - segment.start.x) * (segment.end.x - segment.start.x) +
    (point.y - segment.start.y) * (segment.end.y - segment.start.y)
  if (dotProduct < -POINT_ON_SEGMENT_TOLERANCE_MM) return false

  const squaredLength =
    (segment.end.x - segment.start.x) ** 2 +
    (segment.end.y - segment.start.y) ** 2
  return dotProduct <= squaredLength + POINT_ON_SEGMENT_TOLERANCE_MM
}

export function isPointInPad(
  point: { x: number; y: number },
  pad: PcbSmtPad | PcbPlatedHole,
  layer?: string,
): boolean {
  // A trace endpoint only connects to a pad on the same layer (a top-layer
  // wire can't land on a bottom-layer smt pad without a via).
  if (layer !== undefined) {
    const padIsOnLayer =
      pad.type === "pcb_smtpad"
        ? pad.layer === layer
        : pad.layers.some((padLayer) => padLayer === layer)
    if (!padIsOnLayer) return false
  }

  if (pad.type === "pcb_smtpad") {
    if (pad.shape === "circle") {
      return getDistanceBetweenPoints(point, pad) <= pad.radius
    }

    if (pad.shape === "rect") {
      const halfWidth = pad.width / 2
      const halfHeight = pad.height / 2
      return (
        Math.abs(point.x - pad.x) <= halfWidth &&
        Math.abs(point.y - pad.y) <= halfHeight
      )
    }

    if (pad.shape === "rotated_rect") {
      const dx = point.x - pad.x
      const dy = point.y - pad.y
      const angle = -pad.ccw_rotation
      const rotatedX = dx * Math.cos(angle) - dy * Math.sin(angle)
      const rotatedY = dx * Math.sin(angle) + dy * Math.cos(angle)
      return (
        Math.abs(rotatedX) <= pad.width / 2 &&
        Math.abs(rotatedY) <= pad.height / 2
      )
    }

    if (pad.shape === "pill" || pad.shape === "rotated_pill") {
      if (pad.shape === "rotated_pill") {
        const pill = getPillCenterLineForPad(pad)
        return (
          pointToSegmentDistance(point, pill.start, pill.end) <= pill.radius
        )
      }

      const halfWidth = pad.width / 2
      const halfHeight = pad.height / 2
      const radius = pad.radius

      if (
        Math.abs(point.x - pad.x) <= halfWidth - radius &&
        Math.abs(point.y - pad.y) <= halfHeight
      ) {
        return true
      }

      const cornerX = Math.max(
        Math.abs(point.x - pad.x) - (halfWidth - radius),
        0,
      )
      const cornerY = Math.max(
        Math.abs(point.y - pad.y) - (halfHeight - radius),
        0,
      )
      return cornerX * cornerX + cornerY * cornerY <= radius * radius
    }

    if (pad.shape === "polygon") {
      let inside = false
      for (
        let i = 0, j = pad.points.length - 1;
        i < pad.points.length;
        j = i++
      ) {
        const pi = pad.points[i]
        const pj = pad.points[j]
        if (isPointOnSegment(point, { start: pi, end: pj })) return true

        const intersects =
          pi.y > point.y !== pj.y > point.y &&
          point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x
        if (intersects) inside = !inside
      }
      return inside
    }
  }

  if (pad.type === "pcb_plated_hole") {
    if (pad.shape === "circle") {
      return getDistanceBetweenPoints(point, pad) <= pad.outer_diameter / 2
    }

    if (pad.shape === "oval" || pad.shape === "pill") {
      return (
        Math.abs(point.x - pad.x) <= pad.outer_width / 2 &&
        Math.abs(point.y - pad.y) <= pad.outer_height / 2
      )
    }

    if (pad.shape === "circular_hole_with_rect_pad") {
      return (
        Math.abs(point.x - pad.x) <= pad.rect_pad_width / 2 &&
        Math.abs(point.y - pad.y) <= pad.rect_pad_height / 2
      )
    }

    if (pad.shape === "pill_hole_with_rect_pad") {
      return (
        Math.abs(point.x - pad.x) <= pad.rect_pad_width / 2 &&
        Math.abs(point.y - pad.y) <= pad.rect_pad_height / 2
      )
    }
  }

  return false
}
