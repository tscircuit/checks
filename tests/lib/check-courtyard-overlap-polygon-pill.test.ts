import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"

test("detects overlap involving pcb_courtyard_polygon elements", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_courtyard_polygon",
      pcb_courtyard_polygon_id: "cp1",
      pcb_component_id: "comp_a",
      layer: "top",
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ],
    },
    {
      type: "pcb_courtyard_polygon",
      pcb_courtyard_polygon_id: "cp2",
      pcb_component_id: "comp_b",
      layer: "top",
      points: [
        { x: 3, y: 1 },
        { x: 7, y: 1 },
        { x: 7, y: 5 },
        { x: 3, y: 5 },
      ],
    },
    {
      type: "pcb_courtyard_polygon",
      pcb_courtyard_polygon_id: "cp3",
      pcb_component_id: "comp_c",
      layer: "top",
      points: [
        { x: 10, y: 10 },
        { x: 12, y: 10 },
        { x: 12, y: 12 },
        { x: 10, y: 12 },
      ],
    },
  ]

  const errors = checkCourtyardOverlap(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0]!.pcb_component_ids).toEqual(["comp_a", "comp_b"])
})

test("detects overlap involving pcb_courtyard_pill elements and respects rounded corners", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_courtyard_pill",
      pcb_courtyard_pill_id: "pill1",
      pcb_component_id: "comp_pill",
      layer: "top",
      center: { x: 0, y: 0 },
      width: 6,
      height: 2,
      radius: 1,
    },
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "rect_overlap",
      pcb_component_id: "comp_overlap",
      layer: "top",
      center: { x: 3.5, y: 0 },
      width: 2,
      height: 1,
    },
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "rect_corner_clear",
      pcb_component_id: "comp_corner_clear",
      layer: "top",
      // Near the pill's bounding-box corner (2.9, 0.9), outside the radius=1 rounded cap
      center: { x: 3.4, y: 1.4 },
      width: 1,
      height: 1,
    },
  ]

  const errors = checkCourtyardOverlap(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0]!.pcb_component_ids).toEqual(["comp_pill", "comp_overlap"])
})
