import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaTraceClearance } from "lib/check-via-trace-clearance"

test("a through via requires clearance from an intermediate-layer trace", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      thickness: 1.6,
      num_layers: 4,
      material: "fr4",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "inner_trace",
      route: [
        {
          route_type: "wire",
          x: -1,
          y: 0,
          width: 0.1,
          layer: "inner2",
        },
        {
          route_type: "wire",
          x: 1,
          y: 0,
          width: 0.1,
          layer: "inner2",
        },
      ],
    },
    {
      type: "pcb_via",
      pcb_via_id: "through_via",
      pcb_trace_id: "via_trace",
      x: 0,
      y: 0.3,
      hole_diameter: 0.25,
      outer_diameter: 0.4,
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkViaTraceClearance(circuitJson, {
    connMap: { areIdsConnected: () => false } as any,
  })

  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    pcb_via_id: "through_via",
    pcb_trace_id: "inner_trace",
  })
  expect(errors[0]!.actual_clearance).toBeCloseTo(0.05)
})
