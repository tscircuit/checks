import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement, SchematicText } from "circuit-json"
import { checkSchematicTextOverlap } from "lib/check-schematic-text-overlap"
import { runAllSchematicChecks } from "lib/run-all-checks"

const createText = (overrides: Partial<SchematicText> = {}): SchematicText => ({
  type: "schematic_text",
  schematic_text_id: "schematic_text_1",
  schematic_sheet_id: "schematic_sheet_0",
  text: "USB-C, LiPo Charging & 3.3 V Regulation",
  font_size: 0.18,
  position: { x: -11.55, y: 5.6 },
  rotation: 0,
  anchor: "top_left",
  color: "#000000",
  ...overrides,
})

const smartwatchReproduction: AnyCircuitElement[] = [
  createText(),
  createText({
    schematic_text_id: "schematic_text_2",
    text: "MCU Supply & Decoupling",
  }),
]

describe("checkSchematicTextOverlap", () => {
  test("detects the stacked smartwatch section headings", () => {
    expect(checkSchematicTextOverlap(smartwatchReproduction)).toEqual([
      {
        type: "schematic_text_overlap_warning",
        schematic_text_overlap_warning_id:
          "schematic_text_overlap_warning_schematic_text_1_schematic_text_2",
        warning_type: "schematic_text_overlap_warning",
        message:
          'Schematic text "USB-C, LiPo Charging & 3.3 V Regulation" and "MCU Supply & Decoupling" are stacked at the same position',
        schematic_text_ids: ["schematic_text_1", "schematic_text_2"],
        schematic_sheet_id: "schematic_sheet_0",
        subcircuit_id: undefined,
      },
    ])
  })

  test("is included in runAllSchematicChecks", async () => {
    const warnings = await runAllSchematicChecks(smartwatchReproduction)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.type).toBe("schematic_text_overlap_warning")
  })

  test.each([
    ["a different sheet", { schematic_sheet_id: "schematic_sheet_1" }],
    ["a different subcircuit", { subcircuit_id: "subcircuit_1" }],
    ["a different anchor", { anchor: "top_right" }],
    ["a different rotation", { rotation: 90 }],
    ["a distinct x position", { position: { x: -11.549, y: 5.6 } }],
    ["a distinct y position", { position: { x: -11.55, y: 5.601 } }],
  ] satisfies Array<[string, Partial<SchematicText>]>)(
    "does not warn for %s",
    (_description, overrides) => {
      const secondText = createText({
        schematic_text_id: "schematic_text_2",
        text: "MCU Supply & Decoupling",
        ...overrides,
      })

      expect(
        checkSchematicTextOverlap([createText(), secondText]),
      ).toHaveLength(0)
    },
  )

  test.each([
    ["blank text", { text: "  " }],
    [
      "component-owned text",
      { schematic_component_id: "schematic_component_1" },
    ],
    ["symbol-owned text", { schematic_symbol_id: "schematic_symbol_1" }],
    ["trace-owned text", { source_trace_id: "source_trace_1" }],
  ] satisfies Array<[string, Partial<SchematicText>]>)(
    "ignores %s",
    (_description, overrides) => {
      expect(
        checkSchematicTextOverlap([
          createText(),
          createText({
            schematic_text_id: "schematic_text_2",
            ...overrides,
          }),
        ]),
      ).toHaveLength(0)
    },
  )

  test("normalizes equivalent rotations", () => {
    const warnings = checkSchematicTextOverlap([
      createText({ rotation: 360 }),
      createText({ schematic_text_id: "schematic_text_2", rotation: 0 }),
    ])

    expect(warnings).toHaveLength(1)
  })
})
