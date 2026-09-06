import { expect, test } from "bun:test"
import { runAllSchematicChecks } from "lib/run-all-checks"
import { createReferenceDesignatorCircuitJson } from "tests/fixtures/create-reference-designator-circuit-json"

test("runs with all schematic checks", async () => {
  const warnings = await runAllSchematicChecks(
    createReferenceDesignatorCircuitJson(),
  )

  expect(warnings.map((warning) => warning.styling_issue_type)).toEqual([
    "missing_schematic_sheet",
    "missing_reference_designator_text",
  ])
})
