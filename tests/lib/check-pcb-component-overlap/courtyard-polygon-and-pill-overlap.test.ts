import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"

test("checkCourtyardOverlap detects overlapping pcb_courtyard_polygon elements", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_component",
      pcb_component_id: "pcb_component_1",
      source_component_id: "source_component_1",
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
      layer: "top",
      rotation: 0,
      obstructs_within_bounds: false,
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_component_2",
      source_component_id: "source_component_2",
      center: { x: 1, y: 0 },
      width: 2,
      height: 2,
      layer: "top",
      rotation: 0,
      obstructs_within_bounds: false,
    },
    {
      type: "pcb_courtyard_polygon",
      pcb_courtyard_polygon_id: "cy_poly_1",
      pcb_component_id: "pcb_component_1",
      layer: "top",
      points: [
        { x: -1, y: -1 },
        { x: 1, y: -1 },
        { x: 1, y: 1 },
        { x: -1, y: 1 },
      ],
    },
    {
      type: "pcb_courtyard_polygon",
      pcb_courtyard_polygon_id: "cy_poly_2",
      pcb_component_id: "pcb_component_2",
      layer: "top",
      points: [
        { x: 0, y: -1 },
        { x: 2, y: -1 },
        { x: 2, y: 1 },
        { x: 0, y: 1 },
      ],
    },
  ]

  const errors = checkCourtyardOverlap(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0]?.type).toBe("pcb_courtyard_overlap_error")
  expect(errors[0]?.pcb_component_ids).toEqual([
    "pcb_component_1",
    "pcb_component_2",
  ])
})

test("checkCourtyardOverlap detects overlapping pcb_courtyard_pill elements and ignores non-overlapping ones", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_component",
      pcb_component_id: "pcb_component_1",
      source_component_id: "source_component_1",
      center: { x: 0, y: 0 },
      width: 4,
      height: 2,
      layer: "top",
      rotation: 0,
      obstructs_within_bounds: false,
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_component_2",
      source_component_id: "source_component_2",
      center: { x: 1.5, y: 0 },
      width: 4,
      height: 2,
      layer: "top",
      rotation: 0,
      obstructs_within_bounds: false,
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_component_3",
      source_component_id: "source_component_3",
      center: { x: 10, y: 0 },
      width: 4,
      height: 2,
      layer: "top",
      rotation: 0,
      obstructs_within_bounds: false,
    },
    {
      type: "pcb_courtyard_pill",
      pcb_courtyard_pill_id: "cy_pill_1",
      pcb_component_id: "pcb_component_1",
      center: { x: 0, y: 0 },
      width: 4,
      height: 2,
      radius: 1,
      layer: "top",
    },
    {
      type: "pcb_courtyard_pill",
      pcb_courtyard_pill_id: "cy_pill_2",
      pcb_component_id: "pcb_component_2",
      center: { x: 1.5, y: 0 },
      width: 2,
      height: 4,
      radius: 1,
      layer: "top",
    },
    {
      type: "pcb_courtyard_pill",
      pcb_courtyard_pill_id: "cy_pill_3",
      pcb_component_id: "pcb_component_3",
      center: { x: 10, y: 0 },
      width: 4,
      height: 2,
      radius: 1,
      layer: "top",
    },
  ]

  const errors = checkCourtyardOverlap(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0]?.type).toBe("pcb_courtyard_overlap_error")
  expect(errors[0]?.pcb_component_ids).toEqual([
    "pcb_component_1",
    "pcb_component_2",
  ])
})
