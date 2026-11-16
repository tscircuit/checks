import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"

test("an offset drill that exits its pad is reported as a breakout", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "plated_1",
      shape: "circular_hole_with_rect_pad",
      hole_shape: "circle",
      pad_shape: "rect",
      x: 0,
      y: 0,
      hole_diameter: 0.4,
      hole_offset_x: 0.9,
      hole_offset_y: 0,
      rect_pad_width: 2,
      rect_pad_height: 2,
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0]!.message).toContain("drill breaks out of its copper pad")
})
