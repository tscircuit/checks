import { expect, test } from "bun:test"
import { checkSchematicComponentMissingReferenceDesignatorText } from "lib/check-schematic-component-missing-reference-designator-text"
import { createReferenceDesignatorCircuitJson } from "tests/fixtures/create-reference-designator-circuit-json"

test("accepts attached reference designator text", () => {
  const warnings = checkSchematicComponentMissingReferenceDesignatorText(
    createReferenceDesignatorCircuitJson({ texts: ["STM32F103", " U1 "] }),
  )

  expect(warnings).toHaveLength(0)
})
