import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentOverCutout } from "lib/check-pcb-component-over-cutout"

test("flags a component overlapping a path cutout segment or endcap", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "source_r1",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_r1",
      source_component_id: "source_r1",
      center: { x: 5, y: 0.4 },
      width: 2,
      height: 1,
      rotation: 0,
      layer: "top",
      obstructs_within_bounds: true,
    },
    {
      type: "source_component",
      source_component_id: "source_r2",
      name: "R2",
      ftype: "simple_resistor",
      resistance: 1000,
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_r2",
      source_component_id: "source_r2",
      center: { x: 11.2, y: 0 },
      width: 1,
      height: 1,
      rotation: 0,
      layer: "top",
      obstructs_within_bounds: true,
    },
    {
      type: "source_component",
      source_component_id: "source_r3",
      name: "R3",
      ftype: "simple_resistor",
      resistance: 1000,
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_r3",
      source_component_id: "source_r3",
      center: { x: 5, y: 4 },
      width: 2,
      height: 1,
      rotation: 0,
      layer: "top",
      obstructs_within_bounds: true,
    },
    {
      type: "pcb_cutout",
      pcb_cutout_id: "pcb_cutout_slot",
      shape: "path",
      slot_width: 2,
      route: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    },
  ]

  const errors = checkPcbComponentOverCutout(circuitJson)

  expect(errors).toHaveLength(2)
  expect(errors.map((error) => error.pcb_placement_error_id)).toEqual([
    "component_over_cutout_pcb_r1_pcb_cutout_slot",
    "component_over_cutout_pcb_r2_pcb_cutout_slot",
  ])
})

test("allows a component over its own footprint path cutout", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_component",
      pcb_component_id: "pcb_connector",
      source_component_id: "source_connector",
      center: { x: 5, y: 0 },
      width: 12,
      height: 4,
      rotation: 0,
      layer: "top",
      obstructs_within_bounds: true,
    },
    {
      type: "pcb_cutout",
      pcb_cutout_id: "pcb_cutout_own_slot",
      pcb_component_id: "pcb_connector",
      shape: "path",
      slot_width: 1.5,
      route: [
        { x: 2, y: 0 },
        { x: 8, y: 0 },
      ],
    },
  ]

  expect(checkPcbComponentOverCutout(circuitJson)).toHaveLength(0)
})
