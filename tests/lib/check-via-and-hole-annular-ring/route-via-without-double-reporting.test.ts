import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"
import { makeVia } from "./fixtures"

test("route-point vias carrying dimensions are checked without double-reporting", () => {
  const trace: AnyCircuitElement = {
    type: "pcb_trace",
    pcb_trace_id: "trace_1",
    route: [
      { route_type: "wire", x: 0, y: 0, layer: "top", width: 0.2 },
      {
        route_type: "via",
        x: 1,
        y: 1,
        from_layer: "top",
        to_layer: "bottom",
        hole_diameter: 0.3,
        outer_diameter: 0.35,
      },
      { route_type: "wire", x: 2, y: 2, layer: "bottom", width: 0.2 },
    ],
  }

  const standalone = checkViaAndHoleAnnularRing([trace])
  expect(standalone).toHaveLength(1)
  expect(standalone[0]!.type).toBe("pcb_placement_error")
  expect(standalone[0]!.message).toContain("(1.00mm, 1.00mm)")
  expect(standalone[0]!.message).toContain(
    "annular ring 0.025mm is below the minimum of 0.05mm",
  )

  // the same via also present as a pcb_via element is reported once, via the
  // richer pcb_via error
  const duplicated = checkViaAndHoleAnnularRing([
    trace,
    makeVia(0.3, 0.35, 1, 1),
  ])
  expect(duplicated).toHaveLength(1)
  expect(duplicated[0]!.type).toBe("pcb_placement_error")
  expect(duplicated[0]!.pcb_placement_error_id).toBe("via_annular_ring_via_1")
})
