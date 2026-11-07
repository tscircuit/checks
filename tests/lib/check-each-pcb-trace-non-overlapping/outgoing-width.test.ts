import { expect, test } from "bun:test"
import type { PcbTrace } from "circuit-json"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

test("width transitions use the outgoing wire while retaining taper clearance", () => {
  const traces: PcbTrace[] = [
    {
      type: "pcb_trace",
      pcb_trace_id: "a",
      source_trace_id: "source-a",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.1, layer: "top" },
        { route_type: "wire", x: 2, y: 0, width: 0.6, layer: "top" },
        { route_type: "wire", x: 2, y: -2, width: 0.6, layer: "top" },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "b",
      source_trace_id: "source-b",
      route: [
        { route_type: "wire", x: 0, y: 0.3, width: 0.1, layer: "top" },
        { route_type: "wire", x: 1, y: 0.3, width: 0.1, layer: "top" },
      ],
    },
  ]
  expect(
    checkEachPcbTraceNonOverlapping(traces, { minClearance: 0.1 }),
  ).toEqual([])
  const widened = structuredClone(traces)
  Object.assign(widened[0]!.route[0]!, { width: 0.6 })
  expect(
    checkEachPcbTraceNonOverlapping(widened, { minClearance: 0.1 }),
  ).toHaveLength(1)
  const tapered = structuredClone(traces)
  Object.assign(tapered[0]!.route[0]!, { end_width: 0.6 })
  expect(
    checkEachPcbTraceNonOverlapping(tapered, { minClearance: 0.1 }),
  ).toHaveLength(1)
})
