import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbPlacementError } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"

test("two failing route vias on one trace get distinct error ids", () => {
  const trace: AnyCircuitElement = {
    type: "pcb_trace",
    pcb_trace_id: "trace_1",
    route: [
      {
        route_type: "via",
        x: 1,
        y: 1,
        from_layer: "top",
        to_layer: "bottom",
        hole_diameter: 0.3,
        outer_diameter: 0.35,
      },
      {
        route_type: "via",
        x: 3,
        y: 3,
        from_layer: "top",
        to_layer: "bottom",
        hole_diameter: 0.3,
        outer_diameter: 0.35,
      },
    ],
  }

  const errors = checkViaAndHoleAnnularRing([trace])
  expect(errors).toHaveLength(2)
  const placementErrors = errors.filter(
    (error): error is PcbPlacementError => error.type === "pcb_placement_error",
  )
  expect(placementErrors).toHaveLength(2)
  const ids = placementErrors.map((error) => error.pcb_placement_error_id)
  expect(new Set(ids).size).toBe(2)
  expect(ids).toEqual([
    "via_annular_ring_route_trace_1_0",
    "via_annular_ring_route_trace_1_1",
  ])
  expect(errors[0]!.message).toContain("(1.00mm, 1.00mm)")
  expect(errors[1]!.message).toContain("(3.00mm, 3.00mm)")
})
