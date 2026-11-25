import { expect, test } from "bun:test"
import { schematic_component_styling_warning } from "circuit-json"
import {
  checkSchematicPlacement,
  runAllChecks,
  runAllSchematicChecks,
} from "../.."
import { Circuit } from "tscircuit"
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

async function createConnectorDetourCircuit(connectorX = 7) {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board schTraceAutoLabelEnabled={false} schMaxTraceDistance={100}>
      <pinheader
        name="J1"
        pinCount={3}
        schX={connectorX}
        schY={0}
        schPinArrangement={{
          rightSide: { pins: [1, 2, 3], direction: "top-to-bottom" },
        }}
      />
      {[1, 2, 3].map((pin) => (
        <resistor
          key={pin}
          name={`R${pin}`}
          resistance="1k"
          schX={-5}
          schY={8 - 4 * pin}
          connections={{ pin1: `.J1 > .pin${pin}` }}
        />
      ))}
    </board>,
  )
  await circuit.renderUntilSettled()
  return normalizeFixtureSourcePorts(circuit.getCircuitJson())
}

test("reports connector detours through both entry points without moving components or changing connections", async () => {
  const json = await createConnectorDetourCircuit()
  const original = structuredClone(json)
  const warnings = checkSchematicPlacement(json).filter(
    (w) => w.styling_issue_type === "connector_position_causes_trace_detours",
  )
  expect(warnings).toHaveLength(1)
  const warning = warnings[0]!
  expect(schematic_component_styling_warning.parse(warning)).toEqual(warning)
  expect(warning.message).toContain("Move J1")
  expect(warning.message).toContain("R1, R2, R3")
  expect(warning.message).toContain(
    "Preserve rotation, pin assignments and electrical connections",
  )
  expect(warning.schematic_port_ids).toHaveLength(3)
  for (const run of [runAllChecks, runAllSchematicChecks]) {
    expect(
      (await run(structuredClone(json))).filter(
        (w) =>
          w.type === "schematic_component_styling_warning" &&
          w.styling_issue_type === warning.styling_issue_type,
      ),
    ).toEqual(warnings)
  }
  expect(checkSchematicPlacement([...json, ...warnings])).toEqual(
    checkSchematicPlacement(json),
  )
  expect(json).toEqual(original)
  expect(
    checkSchematicPlacement(await createConnectorDetourCircuit(-9)).filter(
      (w) => w.styling_issue_type === warning.styling_issue_type,
    ),
  ).toEqual([])
  expect(
    checkSchematicPlacement(
      json.filter((e) => e.type !== "schematic_trace"),
    ).filter((w) => w.styling_issue_type === warning.styling_issue_type),
  ).toEqual([])
  for (const e of json) if (e.type === "source_component") e.name = ""
  const unnamed = checkSchematicPlacement(json).filter(
    (w) => w.styling_issue_type === warning.styling_issue_type,
  )
  expect(unnamed).toHaveLength(1)
  expect(unnamed[0]!.message).toContain("unnamed component")
  expect(containsCircuitJsonId(unnamed[0]!.message)).toBe(false)
})
