import { expect, test } from "bun:test"
import { checkViaToPadSpacing } from "lib/check-via-to-pad-spacing"
import type { AnyCircuitElement } from "circuit-json"

test("returns error when via is too close to a plated hole", () => {
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
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "hole1",
      shape: "circle",
      x: 0.6,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.5,
      layers: ["top", "bottom"],
      pcb_component_id: "comp1",
      pcb_port_id: "port1",
    },
  ]
  // center-to-center = 0.6, via radius = 0.3, hole radius = 0.25 => gap = 0.05mm < 0.2mm
  const errors = checkViaToPadSpacing(soup)
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("too close to pad")
})
