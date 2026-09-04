import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbKeepoutOutline } from "circuit-json"
import { getPadBounds, getPadCenter } from "lib/check-pad-clearance/common"
import { checkPcbCopperOverKeepout } from "lib/check-pcb-copper-over-keepout"

test("checks outline keepouts using their polygon rather than bounding box", () => {
  const keepout: PcbKeepoutOutline = {
    type: "pcb_keepout",
    pcb_keepout_id: "keepout_triangle",
    shape: "outline",
    outline: [
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 1, y: 5 },
    ],
    stroke_width: 0.1,
    layers: ["top"],
  }
  const circuitJson: AnyCircuitElement[] = [
    keepout,
    {
      type: "pcb_via",
      pcb_via_id: "via_inside",
      x: 2,
      y: 2,
      hole_diameter: 0.2,
      outer_diameter: 0.5,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_inside",
      shape: "rect",
      x: 1.5,
      y: 3,
      width: 0.5,
      height: 0.5,
      layer: "top",
    },
    {
      type: "pcb_via",
      pcb_via_id: "via_outside_polygon",
      x: 4.5,
      y: 4.5,
      hole_diameter: 0.2,
      outer_diameter: 0.5,
      layers: ["top", "bottom"],
    },
  ]

  expect(getPadBounds(keepout)).toEqual({
    minX: 1,
    minY: 1,
    maxX: 5,
    maxY: 5,
  })
  expect(getPadCenter(keepout)).toEqual({ x: 3, y: 3 })
  expect(
    checkPcbCopperOverKeepout(circuitJson).map(
      (error) => error.pcb_placement_error_id,
    ),
  ).toEqual([
    "copper_over_keepout_pad_inside_keepout_triangle",
    "copper_over_keepout_via_inside_keepout_triangle",
  ])
})
