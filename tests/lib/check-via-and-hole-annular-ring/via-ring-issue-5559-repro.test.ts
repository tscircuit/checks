import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"
import { makeBoard, makeVia } from "./fixtures"

test("tscircuit/tscircuit#5559 repro: a 0.3/0.35mm via on a 0.3/0.6mm board is flagged with its 0.025mm ring", () => {
  const circuitJson: AnyCircuitElement[] = [
    makeBoard({
      min_via_hole_diameter: 0.3,
      min_via_pad_diameter: 0.6,
    }),
    makeVia(0.3, 0.35),
  ]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors).toHaveLength(1)
  const error = errors[0]!
  expect(error.type).toBe("pcb_placement_error")
  if (error.type !== "pcb_placement_error") return
  expect(error.pcb_placement_error_id).toBe("via_annular_ring_via_1")
  // The drill meets the board's 0.3mm minimum, but the pad does not meet
  // 0.6mm and the ring is 0.025mm.
  expect(error.message).toContain("(0.00mm, 0.00mm)")
  expect(error.message).toContain(
    "annular ring 0.025mm is below the minimum of 0.05mm",
  )
  expect(error.message).toContain("minimum via pad of 0.6mm")
  expect(error.message).not.toContain("minimum via drill")
  expect(error.message).not.toContain("via_1")
})
