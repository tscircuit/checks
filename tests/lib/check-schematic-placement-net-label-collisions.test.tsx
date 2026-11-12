import { expect, test } from "bun:test"
import { schematic_component_styling_warning } from "circuit-json"
import {
  checkSchematicPlacement,
  runAllChecks,
  runAllSchematicChecks,
} from "../.."
import { Circuit } from "tscircuit"
import { Fragment } from "react"
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

async function createNetLabelCollisions({
  corrected = false,
  sheets = ["A", "B"],
}: { corrected?: boolean; sheets?: string[] } = {}) {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  const spacing = corrected ? 3 : 1.5
  circuit.add(
    <board schAutoLayoutEnabled={false}>
      {sheets.map((sheet) => (
        <Fragment key={sheet}>
          <schematicsheet name={sheet}>
            <subcircuit name={sheet} schAutoLayoutEnabled={false}>
              {[0, 1, 2].map((i) => (
                <Fragment key={i}>
                  <net name={`SIGNAL_${i}`} />
                  <chip
                    name={`U${i + 1}`}
                    schX={i * spacing}
                    schY={0}
                    schWidth={1}
                    schHeight={1}
                    schPinArrangement={{
                      rightSide: { pins: [1], direction: "top-to-bottom" },
                    }}
                  />
                  <netlabel
                    net={`SIGNAL_${i}`}
                    connectsTo={`U${i + 1}.pin1`}
                    schX={i * spacing + 0.9}
                    schY={0}
                    anchorSide="left"
                  />
                </Fragment>
              ))}
            </subcircuit>
          </schematicsheet>
        </Fragment>
      ))}
    </board>,
  )
  await circuit.renderUntilSettled()
  return normalizeFixtureSourcePorts(circuit.getCircuitJson())
}

test("reports every label collision pair on its own sheet with stable, readable warnings", async () => {
  const json = await createNetLabelCollisions()
  const original = structuredClone(json)
  const warnings = checkSchematicPlacement(json)
  expect(warnings).toHaveLength(4)
  expect(
    new Set(warnings.map((w) => w.schematic_component_styling_warning_id)).size,
  ).toBe(4)
  for (const w of warnings) {
    expect(schematic_component_styling_warning.parse(w)).toEqual(w)
    expect(w.styling_issue_type).toBe("net_label_collision")
    const component = json.find(
      (e) =>
        e.type === "schematic_component" &&
        e.schematic_component_id === w.schematic_component_id,
    )!
    if (component.type !== "schematic_component")
      throw new Error("Missing component")
    const group = json.find(
      (e) =>
        e.type === "schematic_group" &&
        e.schematic_group_id === component.schematic_group_id,
    )!
    if (group.type !== "schematic_group") throw new Error("Missing group")
    expect(w.schematic_sheet_id).toBe(component.schematic_sheet_id)
    expect(w.subcircuit_id).toBe(group.subcircuit_id)
    expect(w.schematic_port_ids).toHaveLength(1)
    expect(containsCircuitJsonId(w.message)).toBe(false)
  }
  expect(new Set(warnings.map((w) => w.schematic_sheet_id)).size).toBe(2)
  expect(warnings[0]!.message).toContain("U2 or U1")
  for (const run of [runAllChecks, runAllSchematicChecks]) {
    expect(
      (await run(structuredClone(json))).filter(
        (w) =>
          w.type === "schematic_component_styling_warning" &&
          w.styling_issue_type === "net_label_collision",
      ),
    ).toEqual(warnings)
  }
  expect(checkSchematicPlacement([...json, ...warnings])).toEqual(warnings)
  expect(json).toEqual(original)
  expect(
    checkSchematicPlacement(
      await createNetLabelCollisions({ corrected: true }),
    ),
  ).toEqual([])
  const unnamed = await createNetLabelCollisions({ sheets: ["A"] })
  for (const e of unnamed)
    if (e.type === "source_component" && e.name === "U1") e.name = ""
  const unnamedWarnings = checkSchematicPlacement(unnamed)
  expect(unnamedWarnings).toHaveLength(2)
  expect(unnamedWarnings[0]!.message).toContain("unnamed component")
  expect(containsCircuitJsonId(unnamedWarnings[0]!.message)).toBe(false)
})
