import { expect, test } from "bun:test"
import { checkViaToPadSpacing } from "lib/check-via-to-pad-spacing"
import type { AnyCircuitElement } from "circuit-json"

test("returns error when via is too close to a rectangular SMT pad", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_via",
      pcb_via_id: "via1",
      x: 0,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "rect",
      x: 0.5,
      y: 0,
      width: 0.4,
      height: 0.3,
      layer: "top",
    },
  ]
  // Via edge at 0.3, pad left edge at 0.3 => gap = 0mm, well below 0.2mm default
  const errors = checkViaToPadSpacing(soup)
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("too close to pad")
})
