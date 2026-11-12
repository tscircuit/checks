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

function createTextCollision({
  kind,
  corrected = false,
}: {
  kind: "component" | "text" | "trace"
  corrected?: boolean
}): AnyCircuitElement[] {
  const sheet = "sheet_a"
  const positions = kind === "component" ? [0, 4] : [-4, 4]
  const json = positions.flatMap((x, i): AnyCircuitElement[] => [
    {
      type: "source_component",
      source_component_id: `source_component_${sheet}_${i}`,
      name: `U${i + 1}`,
      ftype: "simple_chip",
    },
    {
      type: "schematic_component",
      schematic_component_id: `schematic_component_${sheet}_${i}`,
      source_component_id: `source_component_${sheet}_${i}`,
      schematic_sheet_id: sheet,
      subcircuit_id: `subcircuit_${sheet}`,
      center: { x, y: 0 },
      size: { width: 2, height: 2 },
      is_box_with_pins: true,
    },
  ])
  for (const [i, x] of [-3, 3].entries()) {
    json.push(
      {
        type: "source_port",
        source_port_id: `source_port_${i}`,
        source_component_id: `source_component_sheet_a_${i}`,
        name: "SIGNAL",
        pin_number: 1,
      },
      {
        type: "schematic_port",
        schematic_port_id: `schematic_port_${i}`,
        source_port_id: `source_port_${i}`,
        schematic_component_id: `schematic_component_sheet_a_${i}`,
        schematic_sheet_id: "sheet_a",
        center: { x: kind === "component" && i === 0 ? 1 : x, y: 0 },
        facing_direction: i === 0 ? "right" : "left",
        pin_number: 1,
      },
    )
  }
  json.push(
    {
      type: "source_trace",
      source_trace_id: "source_trace_signal",
      connected_source_port_ids: ["source_port_0", "source_port_1"],
      connected_source_net_ids: [],
    },
    {
      type: "schematic_text",
      schematic_text_id: "schematic_text_note",
      schematic_sheet_id: "sheet_a",
      source_trace_id: kind === "text" ? "source_trace_signal" : undefined,
      text: "SIGNAL",
      font_size: 0.3,
      position: { x: 0, y: corrected ? 5 : 0 },
      rotation: 0,
      anchor: "center",
      color: "black",
    },
  )
  if (kind === "trace")
    json.push({
      type: "schematic_trace",
      schematic_trace_id: "schematic_trace_signal",
      source_trace_id: "source_trace_signal",
      schematic_sheet_id: "sheet_a",
      edges: [{ from: { x: -3, y: 0 }, to: { x: 3, y: 0 } }],
      junctions: [],
    })
  if (kind === "text")
    json.push({
      type: "schematic_text",
      schematic_text_id: "schematic_text_other",
      schematic_sheet_id: "sheet_a",
      text: "OTHER",
      font_size: 0.3,
      position: { x: 0.2, y: 0 },
      rotation: 0,
      anchor: "center",
      color: "black",
    })
  return json
}

test("reports component-associated text collisions using body and trace ownership without inventing targets", async () => {
  for (const kind of ["component", "text", "trace"] as const) {
    const json = createTextCollision({ kind })
    const original = structuredClone(json)
    const warnings = checkSchematicPlacement(json)
    expect(warnings).toHaveLength(kind === "component" ? 1 : 2)
    for (const w of warnings) {
      expect(schematic_component_styling_warning.parse(w)).toEqual(w)
      expect(w.styling_issue_type).toBe("schematic_text_collision")
      expect(w.message).toContain('Text "SIGNAL" overlaps')
      expect(w.schematic_sheet_id).toBe("sheet_a")
      expect(w.schematic_port_ids).toHaveLength(1)
      expect(containsCircuitJsonId(w.message)).toBe(false)
    }
    for (const run of [runAllChecks, runAllSchematicChecks]) {
      expect(
        (await run(structuredClone(json))).filter(
          (w) =>
            w.type === "schematic_component_styling_warning" &&
            w.styling_issue_type === "schematic_text_collision",
        ),
      ).toEqual(warnings)
    }
    expect(checkSchematicPlacement([...json, ...warnings])).toEqual(warnings)
    expect(json).toEqual(original)
    expect(
      checkSchematicPlacement(createTextCollision({ kind, corrected: true })),
    ).toEqual([])
    for (const e of json) {
      if (e.type === "source_component") e.name = ""
      if (e.type === "schematic_text") e.text = e.schematic_text_id
    }
    const unnamed = checkSchematicPlacement(json)
    expect(unnamed.length).toBeGreaterThan(0)
    expect(unnamed.every((w) => !containsCircuitJsonId(w.message))).toBe(true)
  }
  const standalone = createTextCollision({ kind: "text" }).filter(
    (e) => e.type === "schematic_text",
  )
  // The existing output schema requires a real component reference. Unowned
  // text-only collisions must not be attached to a fabricated component.
  expect(checkSchematicPlacement(standalone)).toEqual([])
})
