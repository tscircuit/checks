import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test("a plated hole can trigger overlap against opposite-side components", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 20,
      height: 20,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4" as const,
    },
    {
      type: "pcb_component",
      pcb_component_id: "comp_top",
      source_component_id: "source_top",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
      layer: "top",
      rotation: 0,
      subcircuit_id: "subcircuit_0",
      do_not_place: false,
      obstructs_within_bounds: true,
    },
    {
      type: "pcb_component",
      pcb_component_id: "comp_bottom",
      source_component_id: "source_bottom",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
      layer: "bottom",
      rotation: 0,
      subcircuit_id: "subcircuit_0",
      do_not_place: false,
      obstructs_within_bounds: true,
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_top",
      pcb_component_id: "comp_top",
      shape: "rect",
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      layer: "top",
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "hole_bottom",
      pcb_component_id: "comp_bottom",
      shape: "circle",
      x: 0,
      y: 0,
      outer_diameter: 1.5,
      hole_diameter: 0.8,
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkPcbComponentOverlap(soup)

  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_smtpad_ids).toEqual(["pad_top"])
  expect(errors[0].pcb_plated_hole_ids).toEqual(["hole_bottom"])
})
