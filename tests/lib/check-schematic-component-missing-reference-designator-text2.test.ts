import { expect, test } from "bun:test"
import { checkSchematicComponentMissingReferenceDesignatorText } from "lib/check-schematic-component-missing-reference-designator-text"
import { createReferenceDesignatorCircuitJson } from "tests/fixtures/create-reference-designator-circuit-json"

test("accepts a display-name override when the source name is generated", () => {
  const warnings = checkSchematicComponentMissingReferenceDesignatorText(
    createReferenceDesignatorCircuitJson({
      name: "unnamed_chip1",
      displayName: "MCU",
      texts: ["MCU"],
    }),
  )

  expect(warnings).toHaveLength(0)
})
