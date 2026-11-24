import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"
import { makeVia } from "./fixtures"

test("a via meeting the JLCPCB defaults passes without a board", () => {
  const circuitJson: AnyCircuitElement[] = [makeVia(0.3, 0.6)]
  expect(checkViaAndHoleAnnularRing(circuitJson)).toEqual([])
})
