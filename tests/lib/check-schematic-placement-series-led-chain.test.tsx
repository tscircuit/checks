import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { schematic_component_styling_warning } from "circuit-json"
import { Circuit } from "tscircuit"
import {
  checkSchematicPlacement,
  runAllChecks,
  runAllSchematicChecks,
} from "../.."
import { containsCircuitJsonId } from "lib/util/get-readable-names"
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

function seriesLedChain(corrected: boolean) {
  return (
    <board>
      <led name="LED1" schX={0} />
      <led name="LED2" schX={corrected ? 6 : 12} />
      <led name="LED3" schX={corrected ? 12 : 6} />
      <trace name="first_link" from=".LED1 > .cathode" to=".LED2 > .anode" />
      <trace name="second_link" from=".LED2 > .cathode" to=".LED3 > .anode" />
    </board>
  )
}

async function renderCircuit(corrected = false) {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(seriesLedChain(corrected))
  await circuit.renderUntilSettled()
  return normalizeFixtureSourcePorts(circuit.getCircuitJson())
}

const stylingIssueType = "series_led_chain_not_ordered"
const primaryName = "LED1"
const message =
  "The series chain LED1, LED2, LED3 requires long connections behind LED pins. Arrange the LEDs in their connected order, preserving anode/cathode connections, and reroute affected traces. A horizontal, vertical, or clearly connected folded chain is acceptable."

test("series LED chain: reports one warning through both entry points with stable associations", async () => {
  const circuitJson = await renderCircuit()
  for (const element of circuitJson) {
    if (
      element.type === "schematic_component" ||
      element.type === "schematic_port"
    )
      element.schematic_sheet_id = "placement_sheet"
  }
  const original = structuredClone(circuitJson)
  const db = cju(circuitJson)
  const source = db.source_component.list().find((e) => e.name === primaryName)!
  const component = db.schematic_component
    .list()
    .find((e) => e.source_component_id === source.source_component_id)!
  const warnings = checkSchematicPlacement(circuitJson)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toEqual({
    type: "schematic_component_styling_warning",
    warning_type: "schematic_component_styling_warning",
    styling_issue_type: stylingIssueType,
    schematic_component_styling_warning_id: `schematic_component_styling_warning_${component.schematic_component_id}_${stylingIssueType}`,
    schematic_component_id: component.schematic_component_id,
    source_component_id: source.source_component_id,
    schematic_sheet_id: "placement_sheet",
    subcircuit_id:
      component.subcircuit_id ??
      db.schematic_group.get(component.schematic_group_id!)!.subcircuit_id,
    schematic_port_ids: db.schematic_port
      .list()
      .filter(
        (p) => p.schematic_component_id === component.schematic_component_id,
      )
      .map((p) => p.schematic_port_id),
    message,
  })
  expect(schematic_component_styling_warning.parse(warnings[0])).toEqual(
    warnings[0],
  )
  expect(checkSchematicPlacement([...circuitJson, ...warnings])).toEqual(
    warnings,
  )
  expect(circuitJson).toEqual(original)
  for (const runChecks of [runAllSchematicChecks, runAllChecks]) {
    const result = await runChecks(structuredClone(circuitJson))
    expect(
      result.filter(
        (e) =>
          e.type === "schematic_component_styling_warning" &&
          e.styling_issue_type === stylingIssueType,
      ),
    ).toEqual(warnings)
  }
})

test("series LED chain: moving the components clears the warning without changing connectivity", async () => {
  const before = await renderCircuit()
  const after = await renderCircuit(true)
  expect(checkSchematicPlacement(before)).toHaveLength(1)
  expect(checkSchematicPlacement(after)).toEqual([])
  expect(after.filter((e) => e.type.startsWith("source_"))).toEqual(
    before.filter((e) => e.type.startsWith("source_")),
  )
})

test("series LED chain: skips cross-sheet and missing schematic geometry", async () => {
  const circuitJson = await renderCircuit()
  const db = cju(circuitJson)
  const source = db.source_component.list().find((e) => e.name === primaryName)!
  const component = db.schematic_component
    .list()
    .find((e) => e.source_component_id === source.source_component_id)!
  component.schematic_sheet_id = "separate_sheet"
  expect(checkSchematicPlacement(circuitJson)).toEqual([])
  expect(
    checkSchematicPlacement(
      circuitJson.filter((e) => !e.type.startsWith("schematic_")),
    ),
  ).toEqual([])
})

test("series LED chain: unnamed components use readable labels without losing the finding", async () => {
  const circuitJson = await renderCircuit()
  for (const element of circuitJson) {
    if (element.type === "source_component") element.name = ""
  }
  const warnings = checkSchematicPlacement(circuitJson)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]!.message).toContain("unnamed component")
  expect(containsCircuitJsonId(warnings[0]!.message)).toBe(false)
})
