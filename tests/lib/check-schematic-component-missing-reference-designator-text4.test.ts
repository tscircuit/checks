import { expect, test } from "bun:test"
import { checkSchematicComponentMissingReferenceDesignatorText } from "lib/check-schematic-component-missing-reference-designator-text"
import { createReferenceDesignatorCircuitJson } from "tests/fixtures/create-reference-designator-circuit-json"

test("ignores schematic components without a source component", () => {
  const circuitJson = createReferenceDesignatorCircuitJson().filter(
    (element) => element.type !== "source_component",
  )

  expect(
    checkSchematicComponentMissingReferenceDesignatorText(circuitJson),
  ).toHaveLength(0)
})
