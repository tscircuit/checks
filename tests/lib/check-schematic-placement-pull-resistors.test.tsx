import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"
import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { schematic_component_styling_warning } from "circuit-json"
import { Circuit } from "tscircuit"
import {
  checkSchematicPlacement,
  runAllChecks,
  runAllSchematicChecks,
} from "../.."

async function createPullResistorCircuit(
  corrected = false,
  supplyRotation = 270,
) {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <net name="VCC" isPowerNet />
      <net name="GND" isGroundNet />
      <chip
        name="U1"
        pinLabels={{ pin1: "RESET_N", pin2: "BOOT" }}
        pinAttributes={{
          RESET_N: { needsExternalPullup: true },
          BOOT: { needsExternalPulldown: true },
        }}
        schPinArrangement={{
          leftSide: { pins: ["pin1", "pin2"], direction: "top-to-bottom" },
        }}
      />
      <resistor
        name="R1"
        resistance="10k"
        schX={-3}
        schY={corrected ? 3 : -3}
        schRotation={supplyRotation}
      />
      <resistor
        name="R2"
        resistance="10k"
        schX={-6}
        schY={corrected ? -3 : 3}
        schRotation={90}
      />
      <trace name="reset_pullup" from=".U1 > .RESET_N" to=".R1 > .pin2" />
      <trace name="pullup_supply" from=".R1 > .pin1" to="net.VCC" />
      <trace name="boot_pulldown" from=".U1 > .BOOT" to=".R2 > .pin1" />
      <trace name="pulldown_ground" from=".R2 > .pin2" to="net.GND" />
    </board>,
  )
  await circuit.renderUntilSettled()
  return normalizeFixtureSourcePorts(circuit.getCircuitJson())
}

test("reports pull-up and pull-down placement warnings on their resistors through both check entry points", async () => {
  const circuitJson = await createPullResistorCircuit()
  for (const element of circuitJson) {
    if (
      element.type === "schematic_component" ||
      element.type === "schematic_port"
    )
      element.schematic_sheet_id = "pull_resistor_sheet"
  }
  const original = structuredClone(circuitJson)
  const warnings = checkSchematicPlacement(circuitJson)
  expect(warnings).toHaveLength(2)
  const db = cju(circuitJson)
  for (const [i, name] of ["R1", "R2"].entries()) {
    const source = db.source_component.list().find((e) => e.name === name)!
    const resistor = db.schematic_component
      .list()
      .find((e) => e.source_component_id === source.source_component_id)!
    expect(warnings[i]).toMatchObject({
      type: "schematic_component_styling_warning",
      styling_issue_type: "pull_resistor_on_wrong_side",
      schematic_component_styling_warning_id: `schematic_component_styling_warning_${resistor.schematic_component_id}_pull_resistor_on_wrong_side`,
      schematic_component_id: resistor.schematic_component_id,
      source_component_id: source.source_component_id,
      schematic_sheet_id: "pull_resistor_sheet",
      subcircuit_id: db.schematic_group.get(resistor.schematic_group_id!)!
        .subcircuit_id,
      schematic_port_ids: db.schematic_port
        .list()
        .filter(
          (e) => e.schematic_component_id === resistor.schematic_component_id,
        )
        .map((e) => e.schematic_port_id),
    })
    expect(schematic_component_styling_warning.parse(warnings[i])).toEqual(
      warnings[i],
    )
  }
  expect(warnings.map((w) => w.message)).toEqual([
    "consider placing R1 above U1.RESET_N so the pull-up branch reads toward power",
    "consider placing R2 below U1.BOOT so the pull-down branch reads toward ground",
  ])
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
          e.styling_issue_type === "pull_resistor_on_wrong_side",
      ),
    ).toEqual(warnings)
  }
})

test("clears corrected placement and does not guess pull roles without pin metadata", async () => {
  const before = await createPullResistorCircuit()
  const after = await createPullResistorCircuit(true)
  expect(checkSchematicPlacement(after)).toEqual([])
  expect(after.filter((e) => e.type.startsWith("source_"))).toEqual(
    before.filter((e) => e.type.startsWith("source_")),
  )
  const separateSheet = structuredClone(before)
  const db = cju(separateSheet)
  const hostSource = db.source_component.list().find((e) => e.name === "U1")!
  const host = db.schematic_component
    .list()
    .find((e) => e.source_component_id === hostSource.source_component_id)!
  host.schematic_sheet_id = "separate_sheet"
  expect(checkSchematicPlacement(separateSheet)).toEqual([])
  for (const element of before) {
    if (element.type !== "source_port") continue
    delete element.needs_external_pullup
    delete element.needs_external_pulldown
  }
  expect(checkSchematicPlacement(before)).toEqual([])
})

test("describes an inverted pull-up supply pin without calling its signal pin ground", async () => {
  const circuitJson = await createPullResistorCircuit(true, 90)
  const warnings = checkSchematicPlacement(circuitJson)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    styling_issue_type: "inverted_rails",
    message:
      "R1 has its positive-supply pin facing down. Rotate R1 by 180° so that pin faces up, preserving pin connections, and reroute attached traces.",
  })
})
