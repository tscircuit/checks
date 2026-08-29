import { expect, test } from "bun:test"
import { checkSchematicComponentMissingReferenceDesignatorText } from "lib/check-schematic-component-missing-reference-designator-text"
import { createReferenceDesignatorCircuitJson } from "tests/fixtures/create-reference-designator-circuit-json"

test("warns when an empty display-name override hides the designator", () => {
  const warnings = checkSchematicComponentMissingReferenceDesignatorText(
    createReferenceDesignatorCircuitJson({ displayName: "", texts: [""] }),
  )

  expect(warnings).toHaveLength(1)
})
