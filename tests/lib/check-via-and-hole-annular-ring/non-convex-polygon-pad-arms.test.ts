import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"

test("a non-convex polygon pad is measured at its arm edges, not its bounds", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "plated_1",
      shape: "hole_with_polygon_pad",
      hole_shape: "circle",
      x: 0,
      y: 0,
      hole_diameter: 0.4,
      hole_offset_x: 0,
      hole_offset_y: 0.6,
      ccw_rotation: 0,
      // plus-sign: arms 0.8mm wide reaching 1.2mm out
      pad_outline: [
        { x: -1.2, y: -0.4 },
        { x: -0.4, y: -0.4 },
        { x: -0.4, y: -1.2 },
        { x: 0.4, y: -1.2 },
        { x: 0.4, y: -0.4 },
        { x: 1.2, y: -0.4 },
        { x: 1.2, y: 0.4 },
        { x: 0.4, y: 0.4 },
        { x: 0.4, y: 1.2 },
        { x: -0.4, y: 1.2 },
        { x: -0.4, y: 0.4 },
        { x: -1.2, y: 0.4 },
      ],
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkViaAndHoleAnnularRing(circuitJson, {
    minPlatedHoleAnnularRing: 0.25,
  })
  expect(errors).toHaveLength(1)
  // the drill sits 0.6mm up the 0.8mm-wide arm: 0.4mm to the arm edge minus
  // the 0.2mm drill radius is 0.2mm of copper, not the 0.4mm its bounds imply
  expect(errors[0]!.message).toContain(
    "annular ring 0.2mm is below the minimum of 0.25mm",
  )
})
