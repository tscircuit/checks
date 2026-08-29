import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { checkSchematicComponentPortsOutsideBody } from "lib/check-schematic-component-ports-outside-body"
import { runAllSchematicChecks } from "lib/run-all-checks"

const createBoxWithPins = ({
  width = 2,
  height = 1.2,
  isBoxWithPins,
  ports,
}: {
  width?: number
  height?: number
  isBoxWithPins?: boolean
  ports: Array<{
    x: number
    y: number
    side: "left" | "right" | "top" | "bottom"
    label: string
  }>
}): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "source_component_1",
    name: "U1",
    ftype: "simple_chip",
  },
  {
    type: "schematic_component",
    schematic_component_id: "schematic_component_1",
    source_component_id: "source_component_1",
    center: { x: 0, y: 0 },
    size: { width, height },
    pin_spacing: 0.2,
    is_box_with_pins: isBoxWithPins ?? true,
  },
  ...ports.map(
    (port, index): AnyCircuitElement => ({
      type: "schematic_port",
      schematic_port_id: `schematic_port_${index + 1}`,
      schematic_component_id: "schematic_component_1",
      source_port_id: `source_port_${index + 1}`,
      center: { x: port.x, y: port.y },
      side_of_component: port.side,
      facing_direction:
        port.side === "top"
          ? "up"
          : port.side === "bottom"
            ? "down"
            : port.side,
      pin_number: index + 1,
      display_pin_label: port.label,
    }),
  ),
]

describe("checkSchematicComponentPortsOutsideBody", () => {
  test("warns when left/right pins exceed schHeight", async () => {
    const circuitJson = createBoxWithPins({
      ports: [
        { x: -1.4, y: 0.9, side: "left", label: "VDD" },
        { x: -1.4, y: 0.3, side: "left", label: "DIN" },
        { x: -1.4, y: -0.9, side: "left", label: "GND" },
        { x: 1.4, y: 0.4, side: "right", label: "OUTP" },
      ],
    })

    const warnings = checkSchematicComponentPortsOutsideBody(circuitJson)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({
      type: "schematic_component_styling_warning",
      styling_issue_type: "ports_outside_body",
      schematic_component_id: "schematic_component_1",
      source_component_id: "source_component_1",
      schematic_port_ids: ["schematic_port_1", "schematic_port_3"],
    })
    expect(warnings[0].message).toBe(
      "U1 has schematic pins outside its body (VDD, GND); increase schHeight to at least 1.80mm",
    )
    expect(await runAllSchematicChecks(circuitJson)).toContainEqual(warnings[0])
    expect(
      convertCircuitJsonToSchematicSvg([...circuitJson, ...warnings], {
        width: 600,
        height: 500,
        grid: true,
      }),
    ).toMatchSvgSnapshot(import.meta.path, "ports-outside-body")
  })

  test("does not warn when pins fit within the body", () => {
    const warnings = checkSchematicComponentPortsOutsideBody(
      createBoxWithPins({
        height: 2,
        ports: [
          { x: -1.4, y: 0.9, side: "left", label: "VDD" },
          { x: -1.4, y: -0.9, side: "left", label: "GND" },
        ],
      }),
    )

    expect(warnings).toHaveLength(0)
  })

  test("warns when top/bottom pins exceed schWidth", () => {
    const warnings = checkSchematicComponentPortsOutsideBody(
      createBoxWithPins({
        ports: [
          { x: -1.2, y: 1, side: "top", label: "A" },
          { x: 1.2, y: -1, side: "bottom", label: "B" },
        ],
      }),
    )

    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain(
      "increase schWidth to at least 2.40mm",
    )
  })

  test("ignores explicit custom-symbol components", () => {
    const warnings = checkSchematicComponentPortsOutsideBody(
      createBoxWithPins({
        isBoxWithPins: false,
        ports: [{ x: -1.4, y: 0.9, side: "left", label: "VDD" }],
      }),
    )

    expect(warnings).toHaveLength(0)
  })
})
