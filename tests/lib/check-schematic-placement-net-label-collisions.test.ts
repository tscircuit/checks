import { expect, test } from "bun:test"
import {
  type AnyCircuitElement,
  schematic_component_styling_warning,
} from "circuit-json"
import {
  checkSchematicPlacement,
  runAllChecks,
  runAllSchematicChecks,
} from "../.."
import { containsCircuitJsonId } from "lib/util/get-readable-names"

function createNetLabelCollisions({
  sheet = "sheet_a",
  corrected = false,
}: { sheet?: string; corrected?: boolean } = {}): AnyCircuitElement[] {
  return [0, 1, 2].flatMap((i): AnyCircuitElement[] => {
    const x = i * (corrected ? 5 : 3)
    const key = `${sheet}_${i}`
    return [
      {
        type: "source_component",
        source_component_id: `source_component_${key}`,
        name: `U${i + 1}`,
        ftype: "simple_chip",
      },
      {
        type: "schematic_component",
        schematic_component_id: `schematic_component_${key}`,
        source_component_id: `source_component_${key}`,
        schematic_sheet_id: sheet,
        subcircuit_id: `subcircuit_${sheet}`,
        center: { x, y: 0 },
        size: { width: 1, height: 1 },
        is_box_with_pins: true,
      },
      {
        type: "source_port",
        source_port_id: `source_port_${key}`,
        source_component_id: `source_component_${key}`,
        name: "OUT",
        pin_number: 1,
      },
      {
        type: "schematic_port",
        schematic_port_id: `schematic_port_${key}`,
        source_port_id: `source_port_${key}`,
        schematic_component_id: `schematic_component_${key}`,
        schematic_sheet_id: sheet,
        center: { x: x + 0.7, y: 0 },
        pin_number: 1,
        facing_direction: "right",
      },
      {
        type: "source_net",
        source_net_id: `source_net_${key}`,
        name: `SIGNAL_${i}`,
        member_source_group_ids: [],
      },
      {
        type: "source_trace",
        source_trace_id: `source_trace_${key}`,
        connected_source_port_ids: [`source_port_${key}`],
        connected_source_net_ids: [`source_net_${key}`],
      },
      {
        type: "schematic_net_label",
        schematic_net_label_id: `schematic_net_label_${key}`,
        source_net_id: `source_net_${key}`,
        schematic_sheet_id: sheet,
        center: { x: x + 1.8, y: 0 },
        anchor_position: { x: x + 0.7, y: 0 },
        anchor_side: "left",
        text: `SIGNAL_${i}`,
      },
    ]
  })
}

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
