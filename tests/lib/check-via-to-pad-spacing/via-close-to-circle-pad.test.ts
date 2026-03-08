import { expect, test } from "bun:test"
import { checkViaToPadSpacing } from "lib/check-via-to-pad-spacing"
import type { AnyCircuitElement } from "circuit-json"

test("no error when via gap to circular SMT pad equals minSpacing", () => {
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
      shape: "circle",
      x: 0.7,
      y: 0,
      radius: 0.2,
      layer: "top",
    },
  ]
  // center-to-center = 0.7, via radius = 0.3, pad radius = 0.2 => gap = 0.2mm
  // gap + EPSILON (0.005) >= 0.2mm minSpacing => no error
  const errors = checkViaToPadSpacing(soup)
  expect(errors).toHaveLength(0)
})
