import { expect, test } from "bun:test"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"
import { makeVia } from "./fixtures"

test("an unnamed via is labelled once and never by its pcb_via_id", () => {
  // `pcb_via` carries no public name field in circuit-json, so a via can only
  // reach this check unnamed; the label must still read as one honest phrase.
  const errors = checkViaAndHoleAnnularRing([makeVia(0.3, 0.35)])

  expect(errors).toHaveLength(1)
  const message = errors[0]!.message
  expect(message.startsWith("Unnamed via at (0.00mm, 0.00mm): ")).toBe(true)
  expect(message).not.toContain("via_1")
})
