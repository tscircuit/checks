import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbPlatedHole } from "circuit-json"
import {
  type AnnularRingResult,
  getPlatedHoleAnnularRing,
} from "../../../index"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"

test("the exported helper reports an unmeasurable elliptical plated hole", () => {
  const ellipticalHole = {
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
  } satisfies PcbPlatedHole

  const result: AnnularRingResult = getPlatedHoleAnnularRing(ellipticalHole)
  expect(result.status).toBe("unmeasurable")
  if (result.status !== "unmeasurable") return
  expect(result.reason).toBe("unsupported")
  expect(result.message).toContain("elliptical drills")

  // the check itself only reports measured violations, so the hole is excluded
  const circuitJson: AnyCircuitElement[] = [ellipticalHole]
  expect(checkViaAndHoleAnnularRing(circuitJson)).toEqual([])
})
