import { expect, test } from "bun:test"
import { type AnyCircuitElement, any_circuit_element } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"
import { makeVia } from "./fixtures"

test("every emitted error is valid Circuit JSON, and via errors carry no pcb_via_ids", () => {
  const circuitJson: AnyCircuitElement[] = [
    // a failing pcb_via: 0.35mm pad on a 0.6mm minimum with a 0.025mm ring
    makeVia(0.3, 0.35),
    // a failing route via on a trace, away from the pcb_via above
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_1",
      route: [
        {
          route_type: "via",
          x: 2,
          y: 2,
          from_layer: "top",
          to_layer: "bottom",
          hole_diameter: 0.3,
          outer_diameter: 0.35,
        },
      ],
    },
    // a failing plated hole: 0.1mm ring under the 0.13mm default
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "plated_1",
      shape: "circle",
      x: 4,
      y: 4,
      hole_diameter: 0.8,
      outer_diameter: 1,
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors).toHaveLength(3)
  expect(errors.map((error) => error.type)).toEqual([
    "pcb_placement_error",
    "pcb_placement_error",
    "pcb_placement_error",
  ])
  // `pcb_via_clearance_error` needs two vias; a single-element manufacturing
  // check must not borrow it, since the schema rejects a one-id payload.
  for (const error of errors)
    expect(any_circuit_element.safeParse(error).success).toBe(true)

  const viaError = errors.find(
    (error) => error.pcb_placement_error_id === "via_annular_ring_via_1",
  )!
  expect("pcb_via_ids" in viaError).toBe(false)
  expect("pcb_center" in viaError).toBe(false)
})
