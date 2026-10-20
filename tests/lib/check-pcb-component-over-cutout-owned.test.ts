import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentOverCutout } from "lib/check-pcb-component-over-cutout"

test("allows a component over its own footprint cutout", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_component",
      pcb_component_id: "pcb_component_owner",
      source_component_id: "source_component_owner",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
      rotation: 0,
      layer: "top",
      obstructs_within_bounds: true,
    },
    {
      type: "pcb_cutout",
      pcb_cutout_id: "pcb_cutout_sensor",
      pcb_component_id: "pcb_component_owner",
      shape: "circle",
      center: { x: 0, y: 0 },
      radius: 1,
    },
  ]

  const errors = checkPcbComponentOverCutout(circuitJson)

  expect(errors).toHaveLength(0)
})

test.each([
  {
    name: "empty space between pads",
    obstructsWithinBounds: false,
    cutoutX: 0,
    expectedErrors: 0,
  },
  {
    name: "an SMD pad",
    obstructsWithinBounds: false,
    cutoutX: -4,
    expectedErrors: 1,
  },
  {
    name: "a plated hole",
    obstructsWithinBounds: false,
    cutoutX: 4,
    expectedErrors: 1,
  },
  {
    name: "a solid component body",
    obstructsWithinBounds: true,
    cutoutX: 0,
    expectedErrors: 1,
  },
])(
  "checks cutouts against $name",
  ({ obstructsWithinBounds, cutoutX, expectedErrors }) => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "source_component_header",
        ftype: "simple_chip",
        name: "J1",
      },
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_header",
        source_component_id: "source_component_header",
        center: { x: 0, y: 0 },
        width: 9,
        height: 1,
        rotation: 0,
        layer: "top",
        obstructs_within_bounds: obstructsWithinBounds,
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "left_pad",
        pcb_component_id: "pcb_component_header",
        shape: "rect",
        x: -4,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
      {
        type: "pcb_plated_hole",
        pcb_plated_hole_id: "right_hole",
        pcb_component_id: "pcb_component_header",
        shape: "circle",
        x: 4,
        y: 0,
        outer_diameter: 1,
        hole_diameter: 0.5,
        layers: ["top", "bottom"],
      },
      {
        type: "pcb_cutout",
        pcb_cutout_id: "pcb_cutout_slot",
        shape: "rect",
        center: { x: cutoutX, y: 0 },
        width: 0.5,
        height: 0.5,
      },
    ]

    const errors = checkPcbComponentOverCutout(circuitJson)
    expect(errors).toHaveLength(expectedErrors)
    if (expectedErrors) {
      expect(errors[0]?.message).toContain("Component J1 overlaps")
    }
  },
)
