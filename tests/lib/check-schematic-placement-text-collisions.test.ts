import { expect, test } from "bun:test"
import { schematic_component_styling_warning } from "circuit-json"
import {
  checkSchematicPlacement,
  runAllChecks,
  runAllSchematicChecks,
} from "../.."
import { containsCircuitJsonId } from "lib/util/get-readable-names"
import { createTextCollision } from "../fixtures/schematic-collisions"

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
