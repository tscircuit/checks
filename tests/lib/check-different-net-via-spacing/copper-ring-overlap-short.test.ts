import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkDifferentNetViaSpacing } from "lib/check-different-net-via-spacing"

test("different-net vias whose copper rings overlap are flagged even when the drill holes clear", () => {
  // outer_diameter 0.6mm, hole 0.3mm, centers 0.5mm apart:
  //   copper edge gap = 0.5 - 0.3 - 0.3 = -0.1mm  (annular rings overlap: a short)
  //   hole edge gap   = 0.5 - 0.15 - 0.15 = 0.2mm (clears the 0.1mm hole spacing)
  // The hole-edge check alone passes this clean, so the short was missed.
  const soup = [
    {
      type: "pcb_via",
      pcb_via_id: "via1",
      x: 0,
      y: 0,
      outer_diameter: 0.6,
      hole_diameter: 0.3,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_via",
      pcb_via_id: "via2",
      x: 0.5,
      y: 0,
      outer_diameter: 0.6,
      hole_diameter: 0.3,
      layers: ["top", "bottom"],
    },
  ] as unknown as AnyCircuitElement[]

  const errors = checkDifferentNetViaSpacing(soup)

  expect(errors.length).toBe(1)
  expect(errors[0].message).toContain("different nets are too close")
  expect([...errors[0].pcb_via_ids].sort()).toEqual(["via1", "via2"])
})
