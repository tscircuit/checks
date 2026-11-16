import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"

test("stadium pill holes are measured along both axes", () => {
  const base: AnyCircuitElement = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "plated_1",
    shape: "pill",
    x: 0,
    y: 0,
    hole_width: 1.2,
    hole_height: 0.5,
    outer_width: 2,
    outer_height: 1,
    ccw_rotation: 0,
    layers: ["top", "bottom"],
  }

  // ring is (1 - 0.5) / 2 = 0.25mm on the short axis
  expect(checkViaAndHoleAnnularRing([base])).toEqual([])
  const errors = checkViaAndHoleAnnularRing([base], {
    minPlatedHoleAnnularRing: 0.3,
  })
  expect(errors).toHaveLength(1)
  expect(errors[0]!.message).toContain(
    "annular ring 0.25mm is below the minimum of 0.3mm",
  )
})
