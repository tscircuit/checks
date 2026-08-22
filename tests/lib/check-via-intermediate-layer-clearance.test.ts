import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkViaTraceClearance } from "lib/check-via-trace-clearance"

test("a through via conflicts with unrelated copper on an intermediate layer", () => {
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
          width: 0.15,
          layer: "inner2",
        },
        {
          route_type: "wire",
          x: 1,
          y: 0,
          width: 0.15,
          layer: "inner2",
        },
      ],
    },
    {
      type: "pcb_via",
      pcb_via_id: "through_via",
      pcb_trace_id: "via_trace",
      x: 0,
      y: 0,
      hole_diameter: 0.25,
      outer_diameter: 0.5,
      layers: ["top", "bottom"],
    },
  ]
  const connMap = {
    areIdsConnected: (a: string, b: string) => a === b,
  } as any

  expect(checkViaTraceClearance(circuitJson, { connMap })).toEqual([])
  expect(
    checkEachPcbTraceNonOverlapping(circuitJson, { connMap }),
  ).toContainEqual(
    expect.objectContaining({
      type: "pcb_trace_error",
      pcb_trace_id: "inner_trace",
    }),
  )
})
