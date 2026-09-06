import {
  type AnyCircuitElement,
  type SchematicComponentStylingWarning,
  schematic_component_styling_warning,
} from "circuit-json"

/** Warns about unassigned components only when the circuit declares sheets. */
export function checkSchematicComponentMissingSheet(
  circuitJson: AnyCircuitElement[],
): SchematicComponentStylingWarning[] {
  if (!circuitJson.some((element) => element.type === "schematic_sheet")) {
    return []
  }

  const sourceComponents = circuitJson.filter(
    (element) => element.type === "source_component",
  )
  const sourceComponentById = new Map(
    sourceComponents.map((component) => [
      component.source_component_id,
      component,
    ]),
  )
  const warnings: SchematicComponentStylingWarning[] = []

  for (const component of circuitJson) {
    if (component.type !== "schematic_component") continue
    if (component.schematic_sheet_id || component.is_schematic_group) continue

    let componentName = component.schematic_component_id
    if (component.source_component_id) {
      componentName =
        sourceComponentById.get(component.source_component_id)?.name ??
        componentName
    }

    warnings.push(
      schematic_component_styling_warning.parse({
        type: "schematic_component_styling_warning",
        message: `${componentName} is not assigned to a schematic sheet. Set schSheetName to an existing sheet name.`,
        schematic_component_id: component.schematic_component_id,
        source_component_id: component.source_component_id,
        subcircuit_id: component.subcircuit_id,
        styling_issue_type: "missing_schematic_sheet",
      }),
    )
  }

  return warnings
}
