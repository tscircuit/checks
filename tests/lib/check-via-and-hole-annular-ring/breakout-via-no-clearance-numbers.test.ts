import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"
import { makeVia } from "./fixtures"

test("a breakout via carries no clearance numbers", () => {
  const circuitJson: AnyCircuitElement[] = [makeVia(0.5, 0.4)]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors).toHaveLength(1)
  const error = errors[0]!
  expect(error.message).toContain("breaks out of its pad 0.4mm")
  expect("actual_clearance" in error).toBe(false)
  expect("minimum_clearance" in error).toBe(false)
})
