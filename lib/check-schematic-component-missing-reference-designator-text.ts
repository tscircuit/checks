import type {
  AnyCircuitElement,
  SchematicComponent,
  SchematicComponentStylingWarning,
  SchematicText,
} from "circuit-json"

type SourceComponent = Extract<AnyCircuitElement, { type: "source_component" }>

const isFallbackReferenceDesignator = (name: string) =>
  /^unnamed_[a-z0-9_-]+\d+$/i.test(name)

const isTextWithinComponentBounds = (
  schematicText: SchematicText,
  schematicComponent: SchematicComponent,
) => {
  const { center, size } = schematicComponent
  const tolerance = 1e-9

  return (
    schematicText.position.x >= center.x - size.width / 2 - tolerance &&
    schematicText.position.x <= center.x + size.width / 2 + tolerance &&
    schematicText.position.y >= center.y - size.height / 2 - tolerance &&
    schematicText.position.y <= center.y + size.height / 2 + tolerance
  )
}

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
  const customSymbolTexts: SchematicText[] = []

  for (const schematicText of schematicTexts) {
    if (!schematicText.schematic_component_id) {
      if (schematicText.schematic_symbol_id) {
        customSymbolTexts.push(schematicText)
      }
      continue
    }

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

    const referenceDesignators = new Set(
      [sourceComponent.name, sourceComponent.display_name]
        .map((name) => name?.trim())
        .filter((name): name is string => Boolean(name)),
    )
    const nonFallbackReferenceDesignator = [...referenceDesignators].find(
      (referenceDesignator) =>
        !isFallbackReferenceDesignator(referenceDesignator),
    )
    const componentTexts = textBySchematicComponentId.get(
      schematicComponent.schematic_component_id,
    )
    const hasReferenceDesignatorText =
      [...referenceDesignators].some((referenceDesignator) =>
        componentTexts?.has(referenceDesignator),
      ) ||
      customSymbolTexts.some(
        (schematicText) =>
          referenceDesignators.has(schematicText.text.trim()) &&
          isTextWithinComponentBounds(schematicText, schematicComponent),
      )

    if (nonFallbackReferenceDesignator && hasReferenceDesignatorText) {
      continue
    }

    const readableComponentName =
      nonFallbackReferenceDesignator ?? "Schematic component"

    warnings.push({
      type: "schematic_component_styling_warning",
      schematic_component_styling_warning_id: `schematic_component_styling_warning_${schematicComponent.schematic_component_id}_missing_reference_designator_text`,
      warning_type: "schematic_component_styling_warning",
      message: `${readableComponentName} is missing schematic reference designator text. For a custom symbol, add name="{REFDES}" inside the symbol.`,
      schematic_component_id: schematicComponent.schematic_component_id,
      styling_issue_type: "missing_reference_designator_text",
      source_component_id: schematicComponent.source_component_id,
      schematic_sheet_id: schematicComponent.schematic_sheet_id,
      subcircuit_id: schematicComponent.subcircuit_id,
    })
  }

  return warnings
}
