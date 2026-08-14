import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkSchematicComponentExcessiveTopPadding } from "lib/check-schematic-component-excessive-top-padding"
import { runAllSchematicChecks } from "lib/run-all-checks"

const createBoxWithPins = ({
  height,
  pinYs,
  sides = ["left", "right"],
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
  ...pinYs.map(
    (y, index): AnyCircuitElement => ({
      type: "schematic_port",
      schematic_port_id: `schematic_port_${index + 1}`,
      schematic_component_id: "schematic_component_1",
      source_port_id: `source_port_${index + 1}`,
      center: { x: index % 2 === 0 ? -1.4 : 1.4, y },
      side_of_component: sides[index] ?? "left",
      facing_direction:
        sides[index] === "top"
          ? "up"
          : sides[index] === "bottom"
            ? "down"
            : (sides[index] ?? "left"),
    }),
  ),
]

describe("checkSchematicComponentExcessiveTopPadding", () => {
  test("warns when a tall box has a large blank area above its side pins", () => {
    const warnings = checkSchematicComponentExcessiveTopPadding(
      createBoxWithPins({ height: 5, pinYs: [0.1, -0.1, 0.1, -0.1] }),
    )

    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({
      type: "schematic_component_styling_warning",
      warning_type: "schematic_component_styling_warning",
      styling_issue_type: "excessive_top_padding",
      schematic_component_id: "schematic_component_1",
      source_component_id: "source_component_1",
      schematic_port_ids: [
        "schematic_port_1",
        "schematic_port_2",
        "schematic_port_3",
        "schematic_port_4",
      ],
    })
    expect(warnings[0].message).toContain("J1 has excessive empty space")
  })

  test("does not warn when the highest pin is within three pin spacings", () => {
    const warnings = checkSchematicComponentExcessiveTopPadding(
      createBoxWithPins({ height: 1.8, pinYs: [0.7, 0.5, -0.5, -0.7] }),
    )

    expect(warnings).toHaveLength(0)
  })

  test("ignores pins entering from the top or bottom", () => {
    const warnings = checkSchematicComponentExcessiveTopPadding(
      createBoxWithPins({
        height: 5,
        pinYs: [2.5, -2.5],
        sides: ["top", "bottom"],
      }),
    )

    expect(warnings).toHaveLength(0)
  })

  test("ignores custom symbol components", () => {
    const warnings = checkSchematicComponentExcessiveTopPadding(
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

    expect(warnings).toHaveLength(1)
  })
})
