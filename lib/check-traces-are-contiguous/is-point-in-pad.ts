import type { PcbSmtPad, PcbPlatedHole } from "circuit-json"

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

export function isPointInPad(
  point: { x: number; y: number },
  pad: PcbSmtPad | PcbPlatedHole,
): boolean {
  if (pad.type === "pcb_smtpad") {
    if (pad.shape === "circle") {
      return distance(point.x, point.y, pad.x, pad.y) <= pad.radius
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

    if (pad.shape === "pill") {
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
  }

  if (pad.type === "pcb_plated_hole") {
    if (pad.shape === "circle") {
      return distance(point.x, point.y, pad.x, pad.y) <= pad.outer_diameter / 2
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
