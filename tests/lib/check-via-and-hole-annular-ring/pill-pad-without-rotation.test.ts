import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbPlatedHole } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"

test("a pill pad without ccw_rotation is measured axis-aligned", () => {
  // `ccw_rotation` is schema-required for this shape, but an absent value is
  // read as 0 by every consumer, so the check must measure it too.
  const rotatedPill = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "plated_1",
    shape: "pill",
    x: 0,
    y: 0,
    hole_width: 0.5,
    hole_height: 0.5,
    outer_width: 2,
    outer_height: 1,
    ccw_rotation: 0,
    layers: ["top", "bottom"],
  } satisfies PcbPlatedHole
  const { ccw_rotation: _omitted, ...unrotatedPill } = rotatedPill
  const circuitJson: AnyCircuitElement[] = [unrotatedPill as AnyCircuitElement]

  const errors = checkViaAndHoleAnnularRing(circuitJson, {
    minPlatedHoleAnnularRing: 0.3,
  })
  expect(errors).toHaveLength(1)
  // ring is (1 - 0.5) / 2 = 0.25mm on the short axis
  expect(errors[0]!.message).toContain(
    "annular ring 0.25mm is below the minimum of 0.3mm",
  )
})
