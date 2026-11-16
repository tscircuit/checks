import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"

test("an unrotated polygon pad with no component is measured axis-aligned", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "plated_1",
      shape: "hole_with_polygon_pad",
      hole_shape: "circle",
      x: 0,
      y: 0,
      hole_diameter: 1,
      hole_offset_x: 0,
      hole_offset_y: 0,
      // 1.1mm square pad around the 1mm drill leaves 0.05mm per side
      pad_outline: [
        { x: -0.55, y: -0.55 },
        { x: 0.55, y: -0.55 },
        { x: 0.55, y: 0.55 },
        { x: -0.55, y: 0.55 },
      ],
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors).toHaveLength(1)
  const error = errors[0]!
  expect(error.type).toBe("pcb_placement_error")
  expect(error.message).toContain("(0.00mm, 0.00mm)")
  expect(error.message).toContain(
    "annular ring 0.05mm is below the minimum of 0.13mm",
  )
  expect(error.message).toContain("(drill 1mm)")
})
