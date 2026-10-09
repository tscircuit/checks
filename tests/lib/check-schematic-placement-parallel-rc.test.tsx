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

function parallelRc(corrected: boolean) {
  return (
    <board>
      <net name="GND" isGroundNet />
      <chip
        name="U1"
        schX={-3}
        schY={2}
        pinLabels={{ pin1: "A", pin2: "B", pin3: "C" }}
        schPinArrangement={{
          rightSide: {
            pins: ["pin1", "pin2", "pin3"],
            direction: "top-to-bottom",
          },
        }}
      />
      <resistor
        name="R1"
        resistance="10k"
        schRotation={270}
        schX={1}
        schY={1}
      />
      <capacitor
        name="C1"
        capacitance="10nF"
        schOrientation="vertical"
        schX={corrected ? 4 : 1}
        schY={corrected ? 1 : -3}
      />
      <trace name="chip_connection" from=".U1 > .A" to=".R1 > .pin1" />
      <trace name="parallel_connection" from=".R1 > .pin1" to=".C1 > .pin1" />
      <trace name="resistor_ground" from=".R1 > .pin2" to="net.GND" />
      <trace name="capacitor_ground" from=".C1 > .pin2" to="net.GND" />
    </board>
  )
}

async function renderCircuit(corrected = false) {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(parallelRc(corrected))
  await circuit.renderUntilSettled()
  return normalizeFixtureSourcePorts(circuit.getCircuitJson())
}

const stylingIssueType = "parallel_rc_not_aligned"
const primaryName = "R1"
const message =
  "R1 and C1 share chip-pin and ground connections but are not drawn as adjacent parallel branches. Place their shared connections at matching ends, preserving pin connections and capacitor polarity, and reroute affected traces."

test("parallel RC: reports one warning through both entry points with stable associations", async () => {
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

test("parallel RC: moving the components clears the warning without changing connectivity", async () => {
  const before = await renderCircuit()
  const after = await renderCircuit(true)
  expect(checkSchematicPlacement(before)).toHaveLength(1)
  expect(checkSchematicPlacement(after)).toEqual([])
  expect(after.filter((e) => e.type.startsWith("source_"))).toEqual(
    before.filter((e) => e.type.startsWith("source_")),
  )
})

test("parallel RC: skips cross-sheet and missing schematic geometry", async () => {
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

test("parallel RC: unnamed components use readable labels without losing the finding", async () => {
  const circuitJson = await renderCircuit()
  for (const element of circuitJson) {
    if (element.type === "source_component") element.name = ""
  }
  const warnings = checkSchematicPlacement(circuitJson)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]!.message).toContain("unnamed component")
  expect(containsCircuitJsonId(warnings[0]!.message)).toBe(false)
})
test("parallel RC: missing ground metadata does not become a warning", async () => {
  const circuitJson = await renderCircuit()
  for (const element of circuitJson) {
    if (element.type === "source_net") delete element.is_ground
  }
  expect(checkSchematicPlacement(circuitJson)).toEqual([])
})
