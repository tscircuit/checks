import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"
import { makeVia } from "./fixtures"

test("JLCPCB drill default flags a 0.15mm via drill without a board", () => {
  const circuitJson: AnyCircuitElement[] = [makeVia(0.15, 0.4)]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0]!.message).toContain("minimum via drill of 0.2mm")
})
