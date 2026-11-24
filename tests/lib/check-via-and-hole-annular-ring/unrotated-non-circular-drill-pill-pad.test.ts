import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbPlatedHole } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"

test("an unrotated non-circular drill in a pill pad is measured", () => {
  const rotatedPill = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "plated_1",
    shape: "pill",
    x: 0,
    y: 0,
    hole_width: 0.8,
    hole_height: 0.4,
    outer_width: 2,
    outer_height: 1,
    ccw_rotation: 0,
    layers: ["top", "bottom"],
  } satisfies PcbPlatedHole
  const { ccw_rotation: _rotation, ...unrotatedPill } = rotatedPill
  const circuitJson: AnyCircuitElement[] = [unrotatedPill as AnyCircuitElement]

  const errors = checkViaAndHoleAnnularRing(circuitJson, {
    minPlatedHoleAnnularRing: 0.35,
  })
  expect(errors).toHaveLength(1)
  // a 0.8 x 0.4mm slot centred in a 2 x 1mm stadium leaves 0.3mm on the short
  // axis; skipping on the absent rotation would return no error at all
  expect(errors[0]!.message).toContain(
    "annular ring 0.3mm is below the minimum of 0.35mm",
  )
})
