import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbCourtyardOverlap } from "lib/check-pcb-courtyard-overlap/checkPcbCourtyardOverlap"

// U1 circle: center (0, 0),   radius 1.5 → bbox x: -1.5 to +1.5
// U2 circle: center (2.5, 0), radius 1.5 → bbox x: +1.0 to +4.0
// Bounding box overlap: x = 1.0 → 1.5 (0.5 mm) → error

test("courtyard overlap: circle courtyards", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 1.25, y: 0 },
      width: 8,
      height: 5,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4" as const,
    },
    {
      type: "source_component",
      source_component_id: "source_U1",
      name: "U1",
      ftype: "simple_chip",
    } as AnyCircuitElement,
    {
      type: "source_component",
      source_component_id: "source_U2",
      name: "U2",
      ftype: "simple_chip",
    } as AnyCircuitElement,
    {
      type: "pcb_component",
      pcb_component_id: "pcb_U1",
      source_component_id: "source_U1",
      layer: "top",
      center: { x: 0, y: 0 },
      width: 3,
      height: 3,
      rotation: 0,
      obstructs_within_bounds: false,
    } as AnyCircuitElement,
    {
      type: "pcb_component",
      pcb_component_id: "pcb_U2",
      source_component_id: "source_U2",
      layer: "top",
      center: { x: 2.5, y: 0 },
      width: 3,
      height: 3,
      rotation: 0,
      obstructs_within_bounds: false,
    } as AnyCircuitElement,
    {
      type: "pcb_courtyard_circle",
      pcb_courtyard_circle_id: "crtyd_circle_u1",
      pcb_component_id: "pcb_U1",
      center: { x: 0, y: 0 },
      radius: 1.5,
      layer: "top",
    } as AnyCircuitElement,
    {
      type: "pcb_courtyard_circle",
      pcb_courtyard_circle_id: "crtyd_circle_u2",
      pcb_component_id: "pcb_U2",
      center: { x: 2.5, y: 0 },
      radius: 1.5,
      layer: "top",
    } as AnyCircuitElement,
  ]

  const errors = checkPcbCourtyardOverlap(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].type).toBe("pcb_courtyard_overlap_error")
  expect(errors[0].message).toContain("U1")
  expect(errors[0].message).toContain("U2")

  circuitJson.push(...errors)

  expect(
    convertCircuitJsonToPcbSvg(circuitJson, {
      shouldDrawErrors: true,
      showCourtyards: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
