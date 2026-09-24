import { expect, test } from "bun:test"
import { schematic_component_styling_warning } from "circuit-json"
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
  expect(schematic_component_styling_warning.parse(warnings[0])).toEqual(
    warnings[0],
  )
  expect(checkSchematicPlacement(circuitJson)).toEqual(warnings)
  expect(checkSchematicPlacement([...circuitJson, ...warnings])).toEqual(
    warnings,
  )
  expect(circuitJson).toEqual(original)
})

test.each([undefined, "component_subcircuit"])(
  "preserves component scope and falls back to the owning group: %s",
  (componentSubcircuitId) => {
    const circuitJson = createInvertedRailsCircuitJson()
    const component = circuitJson.find(
      (element) => element.type === "schematic_component",
    )!
    component.subcircuit_id = componentSubcircuitId
    component.schematic_group_id = "schematic_group_1"
    circuitJson.push({
      type: "schematic_group",
      schematic_group_id: "schematic_group_1",
      source_group_id: "source_group_1",
      subcircuit_id: "group_subcircuit",
      schematic_sheet_id: "schematic_sheet_1",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
      schematic_component_ids: [component.schematic_component_id],
    })

    const warnings = checkSchematicPlacement(circuitJson)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.subcircuit_id).toBe(
      componentSubcircuitId ?? "group_subcircuit",
    )
    expect(warnings[0]?.schematic_sheet_id).toBe("schematic_sheet_1")
  },
)

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
