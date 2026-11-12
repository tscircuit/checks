import { expect, test } from "bun:test"
import { schematic_component_styling_warning } from "circuit-json"
import {
  checkSchematicPlacement,
  runAllChecks,
  runAllSchematicChecks,
} from "../.."
import { containsCircuitJsonId } from "lib/util/get-readable-names"
import { createNetLabelCollisions } from "../fixtures/schematic-net-label-collisions"

test("reports every label collision pair on its own sheet with stable, readable warnings", async () => {
  const json = [
    ...createNetLabelCollisions(),
    ...createNetLabelCollisions({ sheet: "sheet_b" }),
  ]
  const original = structuredClone(json)
  const warnings = checkSchematicPlacement(json)
  expect(warnings).toHaveLength(4)
  expect(
    new Set(warnings.map((w) => w.schematic_component_styling_warning_id)).size,
  ).toBe(4)
  for (const w of warnings) {
    expect(schematic_component_styling_warning.parse(w)).toEqual(w)
    expect(w.styling_issue_type).toBe("net_label_collision")
    expect(w.schematic_component_id).toContain(w.schematic_sheet_id!)
    expect(w.subcircuit_id).toBe(`subcircuit_${w.schematic_sheet_id}`)
    expect(w.schematic_port_ids).toHaveLength(1)
    expect(containsCircuitJsonId(w.message)).toBe(false)
  }
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
    checkSchematicPlacement(createNetLabelCollisions({ corrected: true })),
  ).toEqual([])
  const unnamed = createNetLabelCollisions()
  for (const e of unnamed)
    if (e.type === "source_component" && e.name === "U1") e.name = ""
  const unnamedWarnings = checkSchematicPlacement(unnamed)
  expect(unnamedWarnings).toHaveLength(2)
  expect(unnamedWarnings[0]!.message).toContain("unnamed component")
  expect(containsCircuitJsonId(unnamedWarnings[0]!.message)).toBe(false)
})
