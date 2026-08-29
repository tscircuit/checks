import { expect, test } from "bun:test"
import { checkSchematicComponentMissingReferenceDesignatorText } from "lib/check-schematic-component-missing-reference-designator-text"
import { createReferenceDesignatorCircuitJson } from "tests/fixtures/create-reference-designator-circuit-json"

test("warns when the component has no reference designator text", () => {
  const warnings = checkSchematicComponentMissingReferenceDesignatorText(
    createReferenceDesignatorCircuitJson({ texts: ["STM32F103"] }),
  )

  expect(warnings).toEqual([
    {
      type: "schematic_component_styling_warning",
      schematic_component_styling_warning_id:
        "schematic_component_styling_warning_schematic_component_1_missing_reference_designator_text",
      warning_type: "schematic_component_styling_warning",
      message:
        'U1 is missing schematic reference designator text. For a custom symbol, add name="{REFDES}" inside the symbol.',
      schematic_component_id: "schematic_component_1",
      styling_issue_type: "missing_reference_designator_text",
      source_component_id: "source_component_1",
      schematic_sheet_id: undefined,
      subcircuit_id: undefined,
    },
  ])
})
