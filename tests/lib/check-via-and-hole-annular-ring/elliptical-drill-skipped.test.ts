import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"

test("elliptical drills are skipped instead of approximated", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "plated_1",
      shape: "oval",
      x: 0,
      y: 0,
      hole_width: 0.8,
      hole_height: 0.4,
      outer_width: 1.2,
      outer_height: 0.6,
      ccw_rotation: 0,
      layers: ["top", "bottom"],
    },
  ]
  expect(checkViaAndHoleAnnularRing(circuitJson)).toEqual([])
})
