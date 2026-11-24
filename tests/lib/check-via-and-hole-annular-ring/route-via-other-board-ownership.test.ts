import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"
import { makeBoard } from "./fixtures"

test("a route via stays reported when only another board owns the same-name pcb_via", () => {
  // board_1 (first, and the fallback) accepts 0.3/0.5mm vias; board_2 requires
  // a 0.6mm pad for the same geometry.
  const sharedVia: AnyCircuitElement = {
    type: "pcb_via",
    pcb_via_id: "via_1",
    x: 1,
    y: 1,
    hole_diameter: 0.3,
    outer_diameter: 0.5,
    layers: ["top", "bottom"],
    subcircuit_id: "board_1_sub",
  }
  const circuitJson: AnyCircuitElement[] = [
    {
      ...makeBoard({
        min_via_hole_diameter: 0.3,
        min_via_pad_diameter: 0.4,
      }),
      subcircuit_id: "board_1_sub",
    },
    {
      ...makeBoard({
        pcb_board_id: "pcb_board_2",
        min_via_hole_diameter: 0.3,
        min_via_pad_diameter: 0.6,
      }),
      subcircuit_id: "board_2_sub",
    },
    sharedVia,
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_1",
      subcircuit_id: "board_2_sub",
      route: [
        {
          route_type: "via",
          x: 1,
          y: 1,
          from_layer: "top",
          to_layer: "bottom",
          hole_diameter: 0.3,
          outer_diameter: 0.5,
        },
      ],
    },
  ]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors).toHaveLength(1)
  const error = errors[0]!
  expect(error.type).toBe("pcb_placement_error")
  if (error.type !== "pcb_placement_error") return
  expect(error.pcb_placement_error_id).toBe("via_annular_ring_route_trace_1_0")
  expect(error.message).toContain("(1.00mm, 1.00mm)")
  expect(error.message).toContain("minimum via pad of 0.6mm")
  expect(error.message).not.toContain("minimum via drill")
  expect(error.subcircuit_id).toBe("board_2_sub")
})
