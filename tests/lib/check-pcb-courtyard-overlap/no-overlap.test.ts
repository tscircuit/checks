import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbCourtyardOverlap } from "lib/check-pcb-courtyard-overlap/checkPcbCourtyardOverlap"

// U1 courtyard right edge: +1.13
// U2 courtyard left edge:  4.0 − 1.13 = +2.87
// Gap: 1.74 mm → no overlap

test("courtyard overlap: no error when components are well separated", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "crtyd_u1",
      pcb_component_id: "pcb_U1",
      center: { x: 0, y: 0 },
      width: 2.26,
      height: 1.94,
      layer: "top",
    } as AnyCircuitElement,
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "crtyd_u2",
      pcb_component_id: "pcb_U2",
      center: { x: 4.0, y: 0 },
      width: 2.26,
      height: 1.94,
      layer: "top",
    } as AnyCircuitElement,
  ]

  const errors = checkPcbCourtyardOverlap(circuitJson)
  expect(errors).toHaveLength(0)
})
