import type {
  AnyCircuitElement,
  PcbComponent,
  PcbPlacementError,
} from "circuit-json"
import { getReadableNameForComponent } from "./util/get-readable-names"

const courtyardTypes = new Set([
  "pcb_courtyard_circle",
  "pcb_courtyard_outline",
  "pcb_courtyard_polygon",
  "pcb_courtyard_pill",
  "pcb_courtyard_rect",
])

/** Returns a placement error for every PCB component without a courtyard. */
export function checkPcbComponentsMissingCourtyard(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  const componentIdsWithCourtyards = new Set(
    circuitJson
      .filter((element) => courtyardTypes.has(element.type))
      .flatMap((element) =>
        "pcb_component_id" in element && element.pcb_component_id
          ? [element.pcb_component_id]
          : [],
      ),
  )

  return circuitJson
    .filter(
      (element): element is PcbComponent => element.type === "pcb_component",
    )
    .filter(
      (component) =>
        !componentIdsWithCourtyards.has(component.pcb_component_id),
    )
    .map((component) => {
      const sourceComponent = component.source_component_id
        ? circuitJson.find(
            (element) =>
              element.type === "source_component" &&
              element.source_component_id === component.source_component_id,
          )
        : undefined
      const componentName =
        sourceComponent?.type === "source_component"
          ? sourceComponent.name
          : getReadableNameForComponent(circuitJson, component.pcb_component_id)

      return {
        type: "pcb_placement_error" as const,
        pcb_placement_error_id: `missing_courtyard_${component.pcb_component_id}`,
        error_type: "pcb_placement_error" as const,
        message: `${componentName} has no courtyard`,
        subcircuit_id: component.subcircuit_id,
      }
    })
}
