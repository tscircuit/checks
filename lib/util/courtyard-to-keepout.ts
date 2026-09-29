import type {
  PCBKeepout,
  PcbCourtyardCircle,
  PcbCourtyardOutline,
  PcbCourtyardPolygon,
  PcbCourtyardRect,
} from "circuit-json"
import { getRotatedRectPoints } from "lib/check-each-pcb-trace-non-overlapping/segment-to-polygon-clearance"

export type CourtyardElement =
  | PcbCourtyardCircle
  | PcbCourtyardOutline
  | PcbCourtyardPolygon
  | PcbCourtyardRect

const getCourtyardId = (courtyard: CourtyardElement): string => {
  switch (courtyard.type) {
    case "pcb_courtyard_circle":
      return courtyard.pcb_courtyard_circle_id
    case "pcb_courtyard_outline":
      return courtyard.pcb_courtyard_outline_id
    case "pcb_courtyard_polygon":
      return courtyard.pcb_courtyard_polygon_id
    case "pcb_courtyard_rect":
      return courtyard.pcb_courtyard_rect_id
  }
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
