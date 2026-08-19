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

/** Returns a warning for every PCB component without a courtyard. */
export function checkPcbComponentsMissingCourtyard(
  circuitJson: AnyCircuitElement[],
): PcbComponentMissingCourtyardWarning[] {
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
