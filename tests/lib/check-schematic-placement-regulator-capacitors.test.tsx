import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { schematic_component_styling_warning } from "circuit-json"
import { Circuit } from "tscircuit"
import {
  checkSchematicPlacement,
  runAllChecks,
  runAllSchematicChecks,
} from "../.."

async function createRegulatorCircuit(corrected = false) {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <net name="V5" isPowerNet />
      <net name="V3V3" isPowerNet />
      <net name="GND" isGroundNet />
      <chip
        name="U1"
        pinLabels={{ pin1: "IN", pin2: "GND", pin3: "OUT" }}
        schPinArrangement={{
          leftSide: { pins: ["pin1"], direction: "top-to-bottom" },
          bottomSide: { pins: ["pin2"], direction: "left-to-right" },
          rightSide: { pins: ["pin3"], direction: "top-to-bottom" },
        }}
      />
      <capacitor
        name="CIN"
        capacitance="4.7uF"
        schOrientation="vertical"
        schX={corrected ? -4 : 4}
        schY={-1}
      />
      <capacitor
        name="COUT"
        capacitance="4.7uF"
        schOrientation="vertical"
        schX={corrected ? 4 : -4}
        schY={-1.5}
      />
      <trace name="input_supply" from=".U1 > .IN" to="net.V5" />
      <trace name="output_supply" from=".U1 > .OUT" to="net.V3V3" />
      <trace name="regulator_ground" from=".U1 > .GND" to="net.GND" />
      <trace name="input_capacitor" from=".CIN > .pin1" to=".U1 > .IN" />
      <trace name="output_capacitor" from=".COUT > .pin1" to=".U1 > .OUT" />
      <trace name="input_ground" from=".CIN > .pin2" to="net.GND" />
      <trace name="output_ground" from=".COUT > .pin2" to="net.GND" />
    </board>,
  )
  await circuit.renderUntilSettled()
  return circuit.getCircuitJson()
}

test("reports one regulator warning through both check entry points with stable component and scope associations", async () => {
  const circuitJson = await createRegulatorCircuit()
  for (const element of circuitJson) {
    if (
      element.type === "schematic_component" ||
      element.type === "schematic_port"
    )
      element.schematic_sheet_id = "regulator_sheet"
  }
  const db = cju(circuitJson)
  const source = db.source_component.list().find((e) => e.name === "U1")!
  const regulator = db.schematic_component
    .list()
    .find((e) => e.source_component_id === source.source_component_id)!
  const original = structuredClone(circuitJson)
  const warnings = checkSchematicPlacement(circuitJson)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    type: "schematic_component_styling_warning",
    styling_issue_type: "regulator_capacitors_on_wrong_sides",
    schematic_component_styling_warning_id: `schematic_component_styling_warning_${regulator.schematic_component_id}_regulator_capacitors_on_wrong_sides`,
    schematic_component_id: regulator.schematic_component_id,
    source_component_id: source.source_component_id,
    schematic_sheet_id: "regulator_sheet",
    subcircuit_id: db.schematic_group.get(regulator.schematic_group_id!)!
      .subcircuit_id,
    schematic_port_ids: db.schematic_port
      .list()
      .filter(
        (e) => e.schematic_component_id === regulator.schematic_component_id,
      )
      .map((e) => e.schematic_port_id),
  })
  expect(warnings[0]!.message).toBe(
    "Place CIN near U1.IN on the left side and COUT near U1.OUT on the right side. Preserve all connections and leave room for labels; exact alignment is not required.",
  )
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
          e.styling_issue_type === "regulator_capacitors_on_wrong_sides",
      ),
    ).toEqual(warnings)
  }
})

test("clears the warning after placement correction and skips incomplete or cross-sheet networks", async () => {
  const before = await createRegulatorCircuit()
  const after = await createRegulatorCircuit(true)
  expect(checkSchematicPlacement(after)).toEqual([])
  expect(after.filter((e) => e.type.startsWith("source_"))).toEqual(
    before.filter((e) => e.type.startsWith("source_")),
  )
  const db = cju(before)
  const capSource = db.source_component.list().find((e) => e.name === "CIN")!
  const cap = db.schematic_component
    .list()
    .find((e) => e.source_component_id === capSource.source_component_id)!
  cap.schematic_sheet_id = "separate_sheet"
  expect(checkSchematicPlacement(before)).toEqual([])
  expect(
    checkSchematicPlacement(
      before.filter((e) => !e.type.startsWith("schematic_")),
    ),
  ).toEqual([])
})
