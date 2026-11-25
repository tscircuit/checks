import type {
  AnyCircuitElement,
  PcbComponent,
  PcbComponentMissingCourtyardWarning,
} from "circuit-json"
import { getReadableNameForComponent } from "./util/get-readable-names"

const courtyardTypes = new Set([
  "pcb_courtyard_circle",
  "pcb_courtyard_outline",
  "pcb_courtyard_polygon",
  "pcb_courtyard_pill",
  "pcb_courtyard_rect",
])

/** Returns warnings for PCB components without courtyards, excluding manually placed vias and test points. */
export function checkPcbComponentsMissingCourtyard(
  circuitJson: AnyCircuitElement[],
): PcbComponentMissingCourtyardWarning[] {
  const courtyardExemptSourceIds = new Set(
    circuitJson.flatMap((element) => {
      if (element.type === "source_manually_placed_via") {
        return [element.source_manually_placed_via_id]
      }
      if (
        element.type === "source_component" &&
        element.ftype === "simple_test_point"
      ) {
        return [element.source_component_id]
      }
      return []
    }),
  )
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
        !componentIdsWithCourtyards.has(component.pcb_component_id) &&
        (!component.source_component_id ||
          !courtyardExemptSourceIds.has(component.source_component_id)),
    )
    .map((component) => {
      const componentName = getReadableNameForComponent(
        circuitJson,
        component.pcb_component_id,
      )

      return {
        type: "pcb_component_missing_courtyard_warning" as const,
        pcb_component_missing_courtyard_warning_id: `pcb_component_missing_courtyard_warning_${component.pcb_component_id}`,
        warning_type: "pcb_component_missing_courtyard_warning" as const,
        message: `${componentName} has no courtyard`,
        pcb_component_id: component.pcb_component_id,
        source_component_id: component.source_component_id,
        subcircuit_id: component.subcircuit_id,
      }
    })
}
