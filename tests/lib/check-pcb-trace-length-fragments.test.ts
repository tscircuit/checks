import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbTraceLengths } from "../.."

test("reports unknown connectivity instead of summing disconnected route fragments", () => {
  const circuit: AnyCircuitElement[] = [
    {
      type: "source_trace",
      source_trace_id: "source",
      connected_source_port_ids: [],
      connected_source_net_ids: [],
      max_length: 10,
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "fragment_1",
      source_trace_id: "source",
      trace_length: 6,
      route: [],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "fragment_2",
      source_trace_id: "source",
      trace_length: 6,
      route: [],
    },
  ]
  expect(checkPcbTraceLengths(circuit)).toEqual([
    expect.objectContaining({
      type: "pcb_trace_warning",
      trace_length_status: "indeterminate",
      maximum_trace_length: 10,
    }),
  ])
})
