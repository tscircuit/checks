import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"

test("a rotated slot in a rotated rounded pad is measured after both rotations", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "plated_1",
      shape: "rotated_pill_hole_with_rect_pad",
      hole_shape: "rotated_pill",
      pad_shape: "rect",
      x: 0,
      y: 0,
      hole_width: 1.8,
      hole_height: 0.5,
      hole_ccw_rotation: 90,
      hole_offset_x: 0,
      hole_offset_y: 0,
      rect_pad_width: 2,
      rect_pad_height: 1.3,
      rect_border_radius: 0.2,
      rect_ccw_rotation: 90,
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors).toHaveLength(1)
  // both rotated 90°: pad spans 1.3mm wide x 2mm high, slot reaches 0.9mm
  // from center vertically against a 1mm half-height pad edge
  expect(errors[0]!.message).toContain(
    "annular ring 0.1mm is below the minimum of 0.13mm",
  )
})
