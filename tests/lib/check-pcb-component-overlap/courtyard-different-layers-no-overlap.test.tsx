import { expect, test } from "bun:test"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"

/**
 * Two components at the same position but on different layers (top vs bottom)
 * should NOT produce a courtyard overlap error.
 *
 * Regression test for: https://github.com/tscircuit/core/issues/2084
 */

test("courtyards on different layers should not produce overlap error", () => {
  const circuitJson: any[] = [
    {
      type: "pcb_component",
      pcb_component_id: "comp1",
      source_component_id: "src1",
      center: { x: 0, y: 0 },
      layer: "top",
      rotation: 0,
      width: 4,
      height: 2,
    },
    {
      type: "source_component",
      source_component_id: "src1",
      name: "R1",
      ftype: "simple_resistor",
    },
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "cy1",
      pcb_component_id: "comp1",
      center: { x: 0, y: 0 },
      width: 4,
      height: 2,
      layer: "top",
    },
    {
      type: "pcb_component",
      pcb_component_id: "comp2",
      source_component_id: "src2",
      center: { x: 0, y: 0 },
      layer: "bottom",
      rotation: 0,
      width: 4,
      height: 2,
    },
    {
      type: "source_component",
      source_component_id: "src2",
      name: "R2",
      ftype: "simple_resistor",
    },
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "cy2",
      pcb_component_id: "comp2",
      center: { x: 0, y: 0 },
      width: 4,
      height: 2,
      layer: "bottom",
    },
  ]

  const errors = checkCourtyardOverlap(circuitJson)
  expect(errors).toHaveLength(0)
})

test("courtyards on same layer should still produce overlap error", () => {
  const circuitJson: any[] = [
    {
      type: "pcb_component",
      pcb_component_id: "comp1",
      source_component_id: "src1",
      center: { x: 0, y: 0 },
      layer: "top",
      rotation: 0,
      width: 4,
      height: 2,
    },
    {
      type: "source_component",
      source_component_id: "src1",
      name: "R1",
      ftype: "simple_resistor",
    },
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "cy1",
      pcb_component_id: "comp1",
      center: { x: 0, y: 0 },
      width: 4,
      height: 2,
      layer: "top",
    },
    {
      type: "pcb_component",
      pcb_component_id: "comp2",
      source_component_id: "src2",
      center: { x: 1, y: 0 },
      layer: "top",
      rotation: 0,
      width: 4,
      height: 2,
    },
    {
      type: "source_component",
      source_component_id: "src2",
      name: "R2",
      ftype: "simple_resistor",
    },
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "cy2",
      pcb_component_id: "comp2",
      center: { x: 1, y: 0 },
      width: 4,
      height: 2,
      layer: "top",
    },
  ]

  const errors = checkCourtyardOverlap(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].type).toBe("pcb_courtyard_overlap_error")
})
