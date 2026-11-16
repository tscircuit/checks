import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"

test("concentric plated hole rings are checked against the 0.13mm default", () => {
  const passing: AnyCircuitElement[] = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "plated_1",
      shape: "circle",
      x: 0,
      y: 0,
      hole_diameter: 0.8,
      outer_diameter: 1.1,
      layers: ["top", "bottom"],
    },
  ]
  expect(checkViaAndHoleAnnularRing(passing)).toEqual([])

  const failing: AnyCircuitElement[] = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "plated_1",
      shape: "circle",
      x: 2,
      y: 1,
      hole_diameter: 0.8,
      outer_diameter: 1,
      layers: ["top", "bottom"],
    },
  ]
  const errors = checkViaAndHoleAnnularRing(failing)
  expect(errors).toHaveLength(1)
  const error = errors[0]!
  expect(error.type).toBe("pcb_placement_error")
  expect(error.message).toContain("(2.00mm, 1.00mm)")
  expect(error.message).toContain(
    "annular ring 0.1mm is below the minimum of 0.13mm",
  )
  expect(error.message).toContain("(drill 0.8mm)")
  expect(error.message).not.toContain("plated_1")
})
