import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"
import { makeVia } from "./fixtures"

test("a via drill wider than its pad is a breakout, not a fake ring number", () => {
  const circuitJson: AnyCircuitElement[] = [makeVia(0.3, 0.2)]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors).toHaveLength(1)
  const error = errors[0]!
  expect(error.message).toContain("breaks out of its pad 0.2mm")
  expect(error.type).toBe("pcb_placement_error")
  // a breakout is not a measured ring, so it carries no clearance numbers
  expect("actual_clearance" in error).toBe(false)
  expect("minimum_clearance" in error).toBe(false)
})
