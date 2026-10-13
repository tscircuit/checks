import { expect, test } from "bun:test"
import type { PcbTrace } from "circuit-json"
import { PcbConnectivityMap } from "circuit-json-to-connectivity-map"
import { createIndexedPcbConnectivityMap } from "lib/util/create-indexed-pcb-connectivity-map"

const wire = (x: number, y: number, width = 0.2, layer: "top" | "bottom" = "top") =>
  ({ route_type: "wire", x, y, width, layer }) as const

/** Folded traces have overlapping envelopes but mostly distant segment copper. */
test("segment connectivity preserves exact contact geometry and stable net IDs", () => {
  const traces: PcbTrace[] = Array.from({ length: 40 }, (_, index) => ({
    type: "pcb_trace",
    pcb_trace_id: `folded_${index}`,
    source_trace_id: `different_net_${index}`,
    route: [
      wire(0, index),
      wire(100, index),
      wire(100, 100 + index),
      wire(0, 100 + index),
    ],
  }))
  traces.push(
    {
      type: "pcb_trace",
      pcb_trace_id: "width_contact",
      route: [wire(40, -0.3, 0.4), wire(60, -0.3, 0)],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "width_near_miss",
      route: [wire(5, -0.30001, 0.4), wire(10, -0.30001, 0)],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "other_layer",
      route: [wire(40, 0, 0.4, "bottom"), wire(60, 0, 0.4, "bottom")],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "degenerate",
      route: [wire(50, 0), wire(50, 0)],
    },
  )
  const original = structuredClone(traces)
  const expected = new PcbConnectivityMap(traces)
  const actual = createIndexedPcbConnectivityMap(traces)
  expect(actual.connMap.netMap).toEqual(expected.connMap.netMap)
  for (const trace of traces) {
    expect(actual.getAllTracesConnectedToTrace(trace.pcb_trace_id)).toEqual(
      expected.getAllTracesConnectedToTrace(trace.pcb_trace_id),
    )
  }
  expect(actual.areTracesConnected("folded_0", "width_contact")).toBe(true)
  expect(actual.areTracesConnected("folded_0", "width_near_miss")).toBe(false)
  expect(actual.areTracesConnected("folded_0", "other_layer")).toBe(false)
  expect(actual.areTracesConnected("folded_0", "degenerate")).toBe(true)
  expect(traces).toEqual(original)
})
