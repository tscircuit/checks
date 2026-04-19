import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaTraceClearance } from "../../lib/check-via-trace-clearance"

test("checkViaTraceClearance reports via and unrelated trace closer than default minimum clearance", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      route: [
        { route_type: "wire", x: -1, y: 0, width: 0.1, layer: "top" },
        { route_type: "wire", x: 1, y: 0, width: 0.1, layer: "top" },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace2",
      route: [],
    },
    {
      type: "pcb_via",
      pcb_via_id: "via1",
      pcb_trace_id: "trace2",
      x: 0,
      y: 0.12,
      hole_diameter: 0.3,
      outer_diameter: 0.4,
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkViaTraceClearance(circuitJson, {
    connMap: {
      areIdsConnected: (a: string, b: string) => a === b,
    } as any,
  })

  expect(errors).toHaveLength(1)
  expect(errors[0].type).toBe("pcb_via_trace_clearance_error")
  expect(errors[0].pcb_via_id).toBe("via1")
  expect(errors[0].pcb_trace_id).toBe("trace1")
  expect(errors[0].minimum_clearance).toBe(0.1)
  expect(errors[0].actual_clearance).toBeLessThan(0.1)
})

test("checkViaTraceClearance ignores vias connected to the trace", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      route: [
        { route_type: "wire", x: -1, y: 0, width: 0.1, layer: "top" },
        { route_type: "wire", x: 1, y: 0, width: 0.1, layer: "top" },
      ],
    },
    {
      type: "pcb_via",
      pcb_via_id: "via1",
      pcb_trace_id: "trace1",
      x: 0,
      y: 0.35,
      hole_diameter: 0.3,
      outer_diameter: 0.4,
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkViaTraceClearance(circuitJson, {
    connMap: {
      areIdsConnected: (a: string, b: string) => a === b,
    } as any,
  })

  expect(errors).toHaveLength(0)
})
