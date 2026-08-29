import type {
  AnyCircuitElement,
  SchematicComponent,
  SchematicComponentStylingWarning,
  SchematicText,
} from "circuit-json"

type SourceComponent = Extract<AnyCircuitElement, { type: "source_component" }>

/**
 * Warns when a schematic component does not have attached text displaying its
 * reference designator (or the component's display-name override).
 */
export function checkSchematicComponentMissingReferenceDesignatorText(
  circuitJson: AnyCircuitElement[],
): SchematicComponentStylingWarning[] {
  const schematicComponents = circuitJson.filter(
    (element): element is SchematicComponent =>
      element.type === "schematic_component",
  )
  const sourceComponents = circuitJson.filter(
    (element): element is SourceComponent =>
      element.type === "source_component",
  )
  const schematicTexts = circuitJson.filter(
    (element): element is SchematicText => element.type === "schematic_text",
  )

  const sourceComponentById = new Map(
    sourceComponents.map((component) => [
      component.source_component_id,
      component,
    ]),
  )
  const textBySchematicComponentId = new Map<string, Set<string>>()

  for (const schematicText of schematicTexts) {
    if (!schematicText.schematic_component_id) continue

    const componentTexts =
      textBySchematicComponentId.get(schematicText.schematic_component_id) ??
      new Set<string>()
    componentTexts.add(schematicText.text.trim())
    textBySchematicComponentId.set(
      schematicText.schematic_component_id,
      componentTexts,
    )
  }

  const warnings: SchematicComponentStylingWarning[] = []

  for (const schematicComponent of schematicComponents) {
    if (!schematicComponent.source_component_id) continue

    const sourceComponent = sourceComponentById.get(
      schematicComponent.source_component_id,
    )
    if (!sourceComponent) continue

    const referenceDesignator = (
      sourceComponent.display_name ?? sourceComponent.name
    ).trim()
    const componentTexts = textBySchematicComponentId.get(
      schematicComponent.schematic_component_id,
    )

    if (referenceDesignator && componentTexts?.has(referenceDesignator)) {
      continue
    }

    warnings.push({
      type: "schematic_component_styling_warning",
      schematic_component_styling_warning_id: `schematic_component_styling_warning_${schematicComponent.schematic_component_id}_missing_reference_designator_text`,
      warning_type: "schematic_component_styling_warning",
      message: `${sourceComponent.name} is missing schematic reference designator text${referenceDesignator && referenceDesignator !== sourceComponent.name ? ` (${referenceDesignator})` : ""}`,
      schematic_component_id: schematicComponent.schematic_component_id,
      styling_issue_type: "missing_reference_designator_text",
      source_component_id: schematicComponent.source_component_id,
      schematic_sheet_id: schematicComponent.schematic_sheet_id,
      subcircuit_id: schematicComponent.subcircuit_id,
    })
  }

  return warnings
}
