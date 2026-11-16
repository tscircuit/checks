import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"
import { makeBoard, makeVia } from "./fixtures"

test("board DRC fields flag undersized drill and pad when the ring itself passes", () => {
  const circuitJson: AnyCircuitElement[] = [
    makeBoard({
      min_via_hole_diameter: 0.3,
      min_via_pad_diameter: 0.6,
    }),
    makeVia(0.25, 0.5),
  ]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors).toHaveLength(1)
  const error = errors[0]!
  expect(error.type).toBe("pcb_placement_error")
  // ring is (0.5 - 0.25) / 2 = 0.125mm, above the 0.05mm minimum
  expect(error.message).toContain("minimum via drill of 0.3mm")
  expect(error.message).toContain("minimum via pad of 0.6mm")
  expect(error.message).not.toContain("annular ring")
})
