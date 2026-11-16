import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"

test("an offset drill is measured at its written position", () => {
  const base: AnyCircuitElement = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "plated_1",
    shape: "circular_hole_with_rect_pad",
    hole_shape: "circle",
    pad_shape: "rect",
    x: 0,
    y: 0,
    hole_diameter: 0.4,
    hole_offset_x: 0.65,
    hole_offset_y: 0,
    rect_pad_width: 2,
    rect_pad_height: 2,
    layers: ["top", "bottom"],
  }

  // nearest pad edge is 1mm away, drill edge at 0.65 + 0.2 = 0.85mm
  expect(checkViaAndHoleAnnularRing([base])).toEqual([])
  const errors = checkViaAndHoleAnnularRing([base], {
    minPlatedHoleAnnularRing: 0.2,
  })
  expect(errors).toHaveLength(1)
  expect(errors[0]!.message).toContain(
    "annular ring 0.15mm is below the minimum of 0.2mm",
  )
})
