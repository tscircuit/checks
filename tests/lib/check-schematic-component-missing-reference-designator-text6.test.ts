import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkSchematicComponentMissingReferenceDesignatorText } from "lib/check-schematic-component-missing-reference-designator-text"
import { createReferenceDesignatorCircuitJson } from "tests/fixtures/create-reference-designator-circuit-json"

const addCustomSymbolText = (text: string): AnyCircuitElement[] => {
  const circuitJson = createReferenceDesignatorCircuitJson({
    texts: [],
  }) as AnyCircuitElement[]

  circuitJson.push({
    type: "schematic_text",
    schematic_text_id: "schematic_text_symbol",
    schematic_symbol_id: "schematic_symbol_1",
    text,
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

  return circuitJson
}

test("accepts the placeholders substituted by core", () => {
  for (const placeholder of ["{REF}", "{NAME}", "{REFERENCE}"]) {
    expect(
      checkSchematicComponentMissingReferenceDesignatorText(
        createReferenceDesignatorCircuitJson({ texts: [placeholder] }),
      ),
    ).toEqual([])
  }
})

test("warns for the unsupported {REFDES} placeholder", () => {
  const warnings = checkSchematicComponentMissingReferenceDesignatorText(
    createReferenceDesignatorCircuitJson({ texts: ["{REFDES}"] }),
  )

  expect(warnings).toHaveLength(1)
  expect(warnings[0].message).toContain('<schematictext text="{REF}" />')
})

test("does not treat {REFDES} in a custom symbol as reference text", () => {
  const warnings = checkSchematicComponentMissingReferenceDesignatorText(
    addCustomSymbolText("{REFDES}"),
  )

  expect(warnings).toHaveLength(1)
  expect(warnings[0].message).toContain('<schematictext text="{REF}" />')
})
