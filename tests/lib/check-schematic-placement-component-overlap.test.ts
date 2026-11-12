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

function createSchematicBoxes({
  positions = [0, 0.4, 0.8],
  sheet = "sheet_a",
}: { positions?: number[]; sheet?: string } = {}): AnyCircuitElement[] {
  return positions.flatMap((x, i): AnyCircuitElement[] => [
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
}

test("reports every overlapping component pair with unique IDs and correct sheet scope", async () => {
  const json = createSchematicBoxes()
  const original = structuredClone(json)
  const warnings = checkSchematicPlacement(json)
  expect(warnings).toHaveLength(3)
  expect(
    new Set(warnings.map((w) => w.schematic_component_styling_warning_id)).size,
  ).toBe(3)
  expect(warnings[0]!.message).toContain("U1 overlaps U2")
  for (const w of warnings) {
    expect(schematic_component_styling_warning.parse(w)).toEqual(w)
    expect(w.styling_issue_type).toBe("component_overlap")
    expect(w.schematic_sheet_id).toBe("sheet_a")
    expect(w.subcircuit_id).toBe("subcircuit_sheet_a")
  }
  for (const run of [runAllChecks, runAllSchematicChecks]) {
    expect(
      (await run(structuredClone(json))).filter(
        (w) =>
          w.type === "schematic_component_styling_warning" &&
          w.styling_issue_type === "component_overlap",
      ),
    ).toEqual(warnings)
  }
  expect(checkSchematicPlacement([...json, ...warnings])).toEqual(warnings)
  expect(json).toEqual(original)
  expect(
    checkSchematicPlacement(createSchematicBoxes({ positions: [0, 3, 6] })),
  ).toEqual([])
  const separateSheets = [
    ...createSchematicBoxes({ positions: [0] }),
    ...createSchematicBoxes({ positions: [0], sheet: "sheet_b" }),
  ]
  expect(checkSchematicPlacement(separateSheets)).toEqual([])
  for (const e of json) if (e.type === "source_component") e.name = ""
  const unnamed = checkSchematicPlacement(json)
  expect(unnamed).toHaveLength(3)
  expect(unnamed[0]!.message).toContain(
    "unnamed component overlaps unnamed component",
  )
  expect(unnamed.every((w) => !containsCircuitJsonId(w.message))).toBe(true)
})
