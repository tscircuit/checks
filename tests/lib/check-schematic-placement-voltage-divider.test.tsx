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

function voltageDivider(corrected: boolean) {
  return (
    <board>
      <net name="V12" isPowerNet />
      <net name="GND" isGroundNet />
      <resistor
        name="R1"
        resistance="10k"
        schRotation={270}
        schX={-2}
        schY={corrected ? 5 : -3}
      />
      <resistor
        name="R2"
        resistance="68k"
        schRotation={270}
        schX={1}
        schY={2}
      />
      <chip
        name="U1"
        schX={5}
        schY={1}
        pinLabels={{ pin1: "ADC" }}
        schPinArrangement={{
          leftSide: { pins: ["pin1"], direction: "top-to-bottom" },
        }}
      />
      <trace name="supply" from=".R1 > .pin1" to="net.V12" />
      <trace name="divider_tap" from=".R1 > .pin2" to=".R2 > .pin1" />
      <trace name="ground" from=".R2 > .pin2" to="net.GND" />
      <trace name="sense" from=".R2 > .pin1" to=".U1 > .ADC" />
    </board>
  )
}

async function renderCircuit(corrected = false) {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(voltageDivider(corrected))
  await circuit.renderUntilSettled()
  return normalizeFixtureSourcePorts(circuit.getCircuitJson())
}

const stylingIssueType = "voltage_divider_supply_resistor_below_ground_resistor"
const primaryName = "R1"
const message =
  "R1, connected to the supply, is below R2, connected to ground. Place R1 above R2 so their shared divider tap is easy to follow. Preserve pin connections and reroute affected traces; exact alignment is not required."

test("voltage divider: reports one warning through both entry points with stable associations", async () => {
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

test("voltage divider: moving the components clears the warning without changing connectivity", async () => {
  const before = await renderCircuit()
  const after = await renderCircuit(true)
  expect(checkSchematicPlacement(before)).toHaveLength(1)
  expect(checkSchematicPlacement(after)).toEqual([])
  expect(after.filter((e) => e.type.startsWith("source_"))).toEqual(
    before.filter((e) => e.type.startsWith("source_")),
  )
})

test("voltage divider: skips cross-sheet and missing schematic geometry", async () => {
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

test("voltage divider: unnamed components use readable labels without losing the finding", async () => {
  const circuitJson = await renderCircuit()
  for (const element of circuitJson) {
    if (element.type === "source_component") element.name = ""
  }
  const warnings = checkSchematicPlacement(circuitJson)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]!.message).toContain("unnamed component")
  expect(containsCircuitJsonId(warnings[0]!.message)).toBe(false)
})

test("voltage divider: missing positive-supply metadata does not become a warning", async () => {
  const circuitJson = await renderCircuit()
  for (const element of circuitJson) {
    if (element.type === "source_net") delete element.is_positive_voltage_source
  }
  expect(checkSchematicPlacement(circuitJson)).toEqual([])
})
