import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentOverCutout } from "lib/check-pcb-component-over-cutout"

test("allows a component over its own footprint cutout", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_component",
      pcb_component_id: "pcb_component_owner",
      source_component_id: "source_component_owner",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
      rotation: 0,
      layer: "top",
      obstructs_within_bounds: true,
    },
    {
      type: "pcb_cutout",
      pcb_cutout_id: "pcb_cutout_sensor",
      pcb_component_id: "pcb_component_owner",
      shape: "circle",
      center: { x: 0, y: 0 },
      radius: 1,
    },
  ]

  const errors = checkPcbComponentOverCutout(circuitJson)

  expect(errors).toHaveLength(0)
})
