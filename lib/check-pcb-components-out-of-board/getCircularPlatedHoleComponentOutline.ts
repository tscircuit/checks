import * as Flatten from "@flatten-js/core"
import type { AnyCircuitElement, PcbComponent } from "circuit-json"

/** Returns the pad and concentric courtyard envelope in board coordinates (mm, +X right, +Y up). */
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
  const padElements = footprintElements.filter(
    (element) => element.type !== "pcb_courtyard_circle",
  )
  if (padElements.length !== 1) return null

  const pad = padElements[0]
  if (pad.type !== "pcb_plated_hole" || pad.shape !== "circle") return null

  // Do not replace larger body bounds with the mounting pad outline.
  if (
    !Flatten.Utils.EQ(component.width, pad.outer_diameter) ||
    !Flatten.Utils.EQ(component.height, pad.outer_diameter) ||
    !Flatten.Utils.EQ(component.center.x, pad.x) ||
    !Flatten.Utils.EQ(component.center.y, pad.y)
  ) {
    return null
  }

  let radius = pad.outer_diameter / 2
  for (const courtyard of footprintElements) {
    if (courtyard.type !== "pcb_courtyard_circle") continue
    // Concentric circles have an exact circular envelope. Other footprints
    // retain the conservative component-bounds check.
    if (
      !Flatten.Utils.EQ(courtyard.center.x, pad.x) ||
      !Flatten.Utils.EQ(courtyard.center.y, pad.y)
    ) {
      return null
    }
    radius = Math.max(radius, courtyard.radius)
  }

  return new Flatten.Circle(new Flatten.Point(pad.x, pad.y), radius)
}
