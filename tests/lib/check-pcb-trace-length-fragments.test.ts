import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbTraceLengths } from "../.."

test("enforces max_length across multiple PCB route fragments", () => {
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
      type: "pcb_trace_too_long_error",
      actual_trace_length: 12,
      maximum_trace_length: 10,
    }),
  ])
})
