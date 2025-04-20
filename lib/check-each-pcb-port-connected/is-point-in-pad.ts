import type { PcbSmtPad, PcbPlatedHole } from "circuit-json"

/**
 * Simple distance calculation between two points
 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

/**
 * Check if a point is within a pad's area
 * For circles and holes: point must be within radius
 * For rectangles and pills: point must be within width/height bounds
 */
export function isPointInPad(
  point: { x: number; y: number },
  pad: PcbSmtPad | PcbPlatedHole,
): boolean {
  // For SMT pads
  if (pad.type === "pcb_smtpad") {
    // Circle: point must be within radius
    if (pad.shape === "circle") {
      return distance(point.x, point.y, pad.x, pad.y) <= pad.radius
    }

    // Rectangle: point must be within width/height bounds
    if (pad.shape === "rect") {
      const halfWidth = pad.width / 2
      const halfHeight = pad.height / 2
      return (
        Math.abs(point.x - pad.x) <= halfWidth &&
        Math.abs(point.y - pad.y) <= halfHeight
      )
    }

    // Rotated rectangle: transform point to pad's coordinate system
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

    // Pill: combination of rectangle and rounded ends
    if (pad.shape === "pill") {
      const halfWidth = pad.width / 2
      const halfHeight = pad.height / 2
      const radius = pad.radius

      // Check if point is in the main rectangle
      if (
        Math.abs(point.x - pad.x) <= halfWidth - radius &&
        Math.abs(point.y - pad.y) <= halfHeight
      ) {
        return true
      }

      // Check if point is in one of the rounded ends
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
  }

  // For plated holes
  if (pad.type === "pcb_plated_hole") {
    // Circle: point must be within outer diameter
    if (pad.shape === "circle") {
      return distance(point.x, point.y, pad.x, pad.y) <= pad.outer_diameter / 2
    }

    // Oval/Pill: point must be within width/height bounds
    if (pad.shape === "oval" || pad.shape === "pill") {
      return (
        Math.abs(point.x - pad.x) <= pad.outer_width / 2 &&
        Math.abs(point.y - pad.y) <= pad.outer_height / 2
      )
    }

    // Rectangular pad with circular hole
    if (pad.shape === "circular_hole_with_rect_pad") {
      return (
        Math.abs(point.x - pad.x) <= pad.rect_pad_width / 2 &&
        Math.abs(point.y - pad.y) <= pad.rect_pad_height / 2
      )
    }

    // Rectangular pad with pill hole
    if (pad.shape === "pill_hole_with_rect_pad") {
      return (
        Math.abs(point.x - pad.x) <= pad.rect_pad_width / 2 &&
        Math.abs(point.y - pad.y) <= pad.rect_pad_height / 2
      )
    }
  }

  return false
}
