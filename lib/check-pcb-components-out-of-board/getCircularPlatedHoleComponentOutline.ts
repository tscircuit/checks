import * as Flatten from "@flatten-js/core"
import type { AnyCircuitElement, PcbComponent } from "circuit-json"

/** Returns a circular footprint envelope in board coordinates (mm, +X right, +Y up). */
export function getCircularPlatedHoleComponentOutline({
  circuitJson,
  component,
}: {
  circuitJson: AnyCircuitElement[]
  component: PcbComponent
}): Flatten.Circle | null {
  const footprintElements = circuitJson.filter(
    (element) =>
      (element.type === "pcb_plated_hole" ||
        element.type === "pcb_smtpad" ||
        element.type === "pcb_hole" ||
        element.type === "pcb_courtyard_circle" ||
        element.type === "pcb_courtyard_rect" ||
        element.type === "pcb_courtyard_pill" ||
        element.type === "pcb_courtyard_polygon" ||
        element.type === "pcb_courtyard_outline") &&
      element.pcb_component_id === component.pcb_component_id,
  )
  if (footprintElements.length !== 1) return null

  const pad = footprintElements[0]
  if (pad.type !== "pcb_plated_hole" || pad.shape !== "circle") return null

  // Do not replace larger body bounds or a footprint with an explicit courtyard.
  if (
    !Flatten.Utils.EQ(component.width, pad.outer_diameter) ||
    !Flatten.Utils.EQ(component.height, pad.outer_diameter) ||
    !Flatten.Utils.EQ(component.center.x, pad.x) ||
    !Flatten.Utils.EQ(component.center.y, pad.y)
  ) {
    return null
  }

  return new Flatten.Circle(
    new Flatten.Point(pad.x, pad.y),
    pad.outer_diameter / 2,
  )
}
