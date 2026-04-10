import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"

test("top and bottom courtyards are analyzed separately", () => {
  const soup: AnyCircuitElement[] = [
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
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "courtyard_top",
      pcb_component_id: "comp_top",
      layer: "top",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
      subcircuit_id: "subcircuit_0",
    },
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "courtyard_bottom",
      pcb_component_id: "comp_bottom",
      layer: "bottom",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
      subcircuit_id: "subcircuit_0",
    },
  ]

  expect(checkCourtyardOverlap(soup)).toHaveLength(0)
})
