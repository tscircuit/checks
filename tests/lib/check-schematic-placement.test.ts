import { expect, test } from "bun:test"
import {
  checkSchematicPlacement,
  runAllChecks,
  runAllSchematicChecks,
} from "../.."
import { createInvertedRailsCircuitJson } from "../fixtures/create-inverted-rails-circuit-json"

test("converts inverted rails to a warning with component, port and sheet associations", () => {
  const circuitJson = createInvertedRailsCircuitJson()
  const original = structuredClone(circuitJson)
  const warnings = checkSchematicPlacement(circuitJson)

  expect(warnings).toEqual([
    {
      type: "schematic_component_styling_warning",
      schematic_component_styling_warning_id:
        "schematic_component_styling_warning_schematic_component_1_inverted_rails",
      warning_type: "schematic_component_styling_warning",
      styling_issue_type: "inverted_rails",
      message:
        "C1 has its positive-supply connection below its ground connection. Rotate C1 by 180°, preserving pin connections, and reroute attached traces.",
      schematic_component_id: "schematic_component_1",
      source_component_id: "source_component_1",
      schematic_sheet_id: "schematic_sheet_1",
      subcircuit_id: "subcircuit_1",
      schematic_port_ids: ["schematic_port_1", "schematic_port_2"],
    },
  ])
  expect(checkSchematicPlacement(circuitJson)).toEqual(warnings)
  expect(circuitJson).toEqual(original)
})

test("runAllSchematicChecks and runAllChecks include inverted rails exactly once", async () => {
  const circuitJson = createInvertedRailsCircuitJson()
  const expected = checkSchematicPlacement(circuitJson)

  for (const runChecks of [runAllSchematicChecks, runAllChecks]) {
    const warnings = await runChecks(structuredClone(circuitJson))
    expect(
      warnings.filter(
        (warning) =>
          warning.type === "schematic_component_styling_warning" &&
          warning.styling_issue_type === "inverted_rails",
      ),
    ).toEqual(expected)
  }
})

test.each([
  { orientation: "correct" as const },
  { orientation: "horizontal" as const },
  { positiveSupply: false },
  { ambiguousSupply: true },
])(
  "does not enable broader orientation findings or ambiguous rails: %j",
  async (options) => {
    const circuitJson = createInvertedRailsCircuitJson(options)
    expect(checkSchematicPlacement(circuitJson)).toEqual([])
    expect(await runAllSchematicChecks(circuitJson)).toEqual([])
  },
)

test("accepts circuit JSON without schematic placement", async () => {
  const circuitJson = createInvertedRailsCircuitJson().filter(
    (element) => !element.type.startsWith("schematic_"),
  )
  expect(await runAllSchematicChecks(circuitJson)).toEqual([])
})
