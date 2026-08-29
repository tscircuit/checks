import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { checkSchematicComponentExcessiveVerticalPadding } from "lib/check-schematic-component-excessive-vertical-padding"
import { runAllSchematicChecks } from "lib/run-all-checks"

const createBoxWithPins = ({
  height,
  pinYs,
  sides = [],
  isBoxWithPins = true,
}: {
  height: number
  pinYs: number[]
  sides?: Array<"left" | "right" | "top" | "bottom">
  isBoxWithPins?: boolean
}): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "source_component_1",
    name: "J1",
    ftype: "simple_chip",
  },
  {
    type: "schematic_component",
    schematic_component_id: "schematic_component_1",
    source_component_id: "source_component_1",
    center: { x: 0, y: 0 },
    size: { width: 2, height },
    pin_spacing: 0.2,
    is_box_with_pins: isBoxWithPins,
  },
  ...pinYs.map((y, index): AnyCircuitElement => {
    const side = sides[index] ?? (index % 2 === 0 ? "left" : "right")

    return {
      type: "schematic_port",
      schematic_port_id: `schematic_port_${index + 1}`,
      schematic_component_id: "schematic_component_1",
      source_port_id: `source_port_${index + 1}`,
      center: { x: index % 2 === 0 ? -1.4 : 1.4, y },
      side_of_component: side,
      facing_direction:
        side === "top" ? "up" : side === "bottom" ? "down" : side,
      pin_number: index + 1,
      display_pin_label: `PIN${index + 1}`,
    }
  }),
]

describe("checkSchematicComponentExcessiveVerticalPadding", () => {
  test("warns for both edges when pins are centered in a tall box", () => {
    const circuitJson = createBoxWithPins({
      height: 5,
      pinYs: [0.1, 0.1, -0.1, -0.1],
    })
    const warnings =
      checkSchematicComponentExcessiveVerticalPadding(circuitJson)

    expect(warnings).toHaveLength(2)
    expect(warnings.map((warning) => warning.styling_issue_type)).toEqual([
      "excessive_top_padding",
      "excessive_bottom_padding",
    ])
    for (const warning of warnings) {
      expect(warning).toMatchObject({
        type: "schematic_component_styling_warning",
        warning_type: "schematic_component_styling_warning",
        schematic_component_id: "schematic_component_1",
        source_component_id: "source_component_1",
        schematic_port_ids: [
          "schematic_port_1",
          "schematic_port_2",
          "schematic_port_3",
          "schematic_port_4",
        ],
      })
      expect(warning.message).toContain("J1 has excessive empty space")
    }
    expect(
      convertCircuitJsonToSchematicSvg([...circuitJson, ...warnings], {
        width: 600,
        height: 500,
        grid: true,
      }),
    ).toMatchSvgSnapshot(import.meta.path, "excessive-vertical-padding")
  })

  test("warns only for excessive top padding", () => {
    const warnings = checkSchematicComponentExcessiveVerticalPadding(
      createBoxWithPins({ height: 2, pinYs: [-0.6, -0.6, -0.8, -0.8] }),
    )

    expect(warnings.map((warning) => warning.styling_issue_type)).toEqual([
      "excessive_top_padding",
    ])
  })

  test("warns only for excessive bottom padding", () => {
    const warnings = checkSchematicComponentExcessiveVerticalPadding(
      createBoxWithPins({ height: 2, pinYs: [0.8, 0.8, 0.6, 0.6] }),
    )

    expect(warnings.map((warning) => warning.styling_issue_type)).toEqual([
      "excessive_bottom_padding",
    ])
  })

  test("does not warn when both edges are within three pin spacings", () => {
    const warnings = checkSchematicComponentExcessiveVerticalPadding(
      createBoxWithPins({ height: 1.8, pinYs: [0.7, 0.5, -0.5, -0.7] }),
    )

    expect(warnings).toHaveLength(0)
  })

  test("ignores pins entering from the top or bottom", () => {
    const warnings = checkSchematicComponentExcessiveVerticalPadding(
      createBoxWithPins({
        height: 5,
        pinYs: [2.5, -2.5],
        sides: ["top", "bottom"],
      }),
    )

    expect(warnings).toHaveLength(0)
  })

  test("ignores custom symbol components", () => {
    const warnings = checkSchematicComponentExcessiveVerticalPadding(
      createBoxWithPins({
        height: 5,
        pinYs: [0.1, -0.1],
        isBoxWithPins: false,
      }),
    )

    expect(warnings).toHaveLength(0)
  })

  test("is included in runAllSchematicChecks", async () => {
    const warnings = await runAllSchematicChecks(
      createBoxWithPins({ height: 5, pinYs: [0.1, -0.1] }),
    )

    expect(warnings.map((warning) => warning.styling_issue_type)).toEqual([
      "excessive_top_padding",
      "excessive_bottom_padding",
      "missing_reference_designator_text",
    ])
  })
})
