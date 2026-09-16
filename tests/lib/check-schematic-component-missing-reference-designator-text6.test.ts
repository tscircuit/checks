import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkSchematicComponentMissingReferenceDesignatorText } from "lib/check-schematic-component-missing-reference-designator-text"
import { createReferenceDesignatorCircuitJson } from "tests/fixtures/create-reference-designator-circuit-json"

// The issue's scenario: a custom symbol renders a text placeholder that core
// substitutes with the component's reference designator. In circuit-json that
// text is attached to the component, so the check must treat the
// placeholder as reference-designator text.
test("clears the warning when component text uses the {REF} placeholder", () => {
  const warnings = checkSchematicComponentMissingReferenceDesignatorText(
    createReferenceDesignatorCircuitJson({ texts: ["{REF}"] }),
  )

  expect(warnings).toEqual([])
})

// Tolerance: {REFDES} appears in the previous hint and in existing user
// symbols. Core doesn't substitute it yet, but accepting it keeps old symbols
// warning-free once core adds the alias.
test("custom symbol text using {REFDES} satisfies the check", () => {
  const circuitJson = createReferenceDesignatorCircuitJson({
    texts: [],
  }) as AnyCircuitElement[]
  circuitJson.push({
    type: "schematic_text",
    schematic_text_id: "schematic_text_symbol",
    schematic_symbol_id: "schematic_symbol_1",
    text: "{REFDES}",
    font_size: 0.18,
    position: { x: 0, y: 0 },
    rotation: 0,
    anchor: "center",
    color: "#006464",
  } as AnyCircuitElement)
  circuitJson.push({
    type: "schematic_symbol",
    schematic_symbol_id: "schematic_symbol_1",
    schematic_component_id: "schematic_component_1",
    size: { width: 2, height: 1 },
    center: { x: 0, y: 0 },
  } as AnyCircuitElement)

  const warnings =
    checkSchematicComponentMissingReferenceDesignatorText(circuitJson)

  expect(warnings).toEqual([])
})

test('points users at <schematictext text="{REF}" /> in the warning message', () => {
  const warnings = checkSchematicComponentMissingReferenceDesignatorText(
    createReferenceDesignatorCircuitJson({ texts: [] }),
  )

  expect(warnings.length).toBe(1)
  expect(warnings[0].message).toContain('<schematictext text="{REF}" />')
  expect(warnings[0].message).not.toContain('name="{REFDES}"')
})
