import type {
  PCBKeepout,
  PcbCourtyardCircle,
  PcbCourtyardOutline,
  PcbCourtyardPill,
  PcbCourtyardPolygon,
  PcbCourtyardRect,
} from "circuit-json"
import { getRotatedRectPoints } from "lib/check-each-pcb-trace-non-overlapping/segment-to-polygon-clearance"

export type CourtyardElement =
  | PcbCourtyardCircle
  | PcbCourtyardOutline
  | PcbCourtyardPill
  | PcbCourtyardPolygon
  | PcbCourtyardRect

const getCourtyardId = (courtyard: CourtyardElement): string => {
  switch (courtyard.type) {
    case "pcb_courtyard_circle":
      return courtyard.pcb_courtyard_circle_id
    case "pcb_courtyard_outline":
      return courtyard.pcb_courtyard_outline_id
    case "pcb_courtyard_pill":
      return courtyard.pcb_courtyard_pill_id
    case "pcb_courtyard_polygon":
      return courtyard.pcb_courtyard_polygon_id
    case "pcb_courtyard_rect":
      return courtyard.pcb_courtyard_rect_id
  }
}

const getPillOutlinePoints = (
  courtyard: PcbCourtyardPill,
): Array<{ x: number; y: number }> => {
  const radius = Math.min(
    Math.max(courtyard.radius, 0),
    courtyard.width / 2,
    courtyard.height / 2,
  )
  const hx = courtyard.width / 2 - radius
  const hy = courtyard.height / 2 - radius

  if (radius <= 0) {
    return [
      { x: courtyard.center.x - hx, y: courtyard.center.y - hy },
      { x: courtyard.center.x + hx, y: courtyard.center.y - hy },
      { x: courtyard.center.x + hx, y: courtyard.center.y + hy },
      { x: courtyard.center.x - hx, y: courtyard.center.y + hy },
    ]
  }

  const cornerSteps = 8
  const corners = [
    { cx: courtyard.center.x + hx, cy: courtyard.center.y + hy, start: 0 },
    {
      cx: courtyard.center.x - hx,
      cy: courtyard.center.y + hy,
      start: Math.PI / 2,
    },
    {
      cx: courtyard.center.x - hx,
      cy: courtyard.center.y - hy,
      start: Math.PI,
    },
    {
      cx: courtyard.center.x + hx,
      cy: courtyard.center.y - hy,
      start: (3 * Math.PI) / 2,
    },
  ]
  const points: Array<{ x: number; y: number }> = []
  for (const { cx, cy, start } of corners) {
    for (let step = 0; step < cornerSteps; step++) {
      const angle = start + (step * (Math.PI / 2)) / cornerSteps
      points.push({
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      })
    }
  }
  return points
}

/**
 * Reuse the clearance geometry for courtyard overlap checks.
 * Rectangular courtyards become polygons so their rotation is preserved.
 */
export const courtyardToKeepout = (courtyard: CourtyardElement): PCBKeepout => {
  const common = {
    type: "pcb_keepout" as const,
    pcb_keepout_id: getCourtyardId(courtyard),
    layers: [courtyard.layer],
  }

  if (courtyard.type === "pcb_courtyard_circle") {
    return {
      ...common,
      shape: "circle",
      center: courtyard.center,
      radius: courtyard.radius,
    }
  }

  const outline =
    courtyard.type === "pcb_courtyard_rect"
      ? getRotatedRectPoints({
          x: courtyard.center.x,
          y: courtyard.center.y,
          width: courtyard.width,
          height: courtyard.height,
          ccwRotation: courtyard.ccw_rotation ?? 0,
        })
      : courtyard.type === "pcb_courtyard_pill"
        ? getPillOutlinePoints(courtyard)
        : courtyard.type === "pcb_courtyard_polygon"
          ? courtyard.points
          : courtyard.outline

  return {
    ...common,
    shape: "outline",
    outline,
    stroke_width: 0,
  }
}
