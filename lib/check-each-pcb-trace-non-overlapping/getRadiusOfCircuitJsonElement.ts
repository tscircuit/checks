import type {
  AnyCircuitElement,
  PcbHole,
  PcbPlatedHole,
  PcbVia,
  PcbSmtPad,
} from "circuit-json"

export const getRadiusOfCircuitJsonElement = (
  obj: PcbVia | PcbPlatedHole | PcbHole | PcbSmtPad,
) => {
  if (obj.type === "pcb_via") {
    return obj.outer_diameter / 2
  }
  if (obj.type === "pcb_plated_hole" && obj.shape === "circle") {
    return obj.outer_diameter / 2
  }
  if (obj.type === "pcb_hole" && obj.hole_shape === "circle") {
    return obj.hole_diameter / 2
  }
  if (obj.type === "pcb_smtpad" && obj.shape === "circle") {
    return obj.radius
  }
  throw new Error(
    `Could not determine radius of element: ${JSON.stringify(obj)}`,
  )
}
