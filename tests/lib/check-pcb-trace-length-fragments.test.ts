import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import {
  analyzePcbTraceLengths,
  checkPcbTraceLengths,
} from "../../lib/check-pcb-trace-lengths"

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
  expect(checkPcbTraceLengths(circuit)).toEqual([])
  expect(analyzePcbTraceLengths(circuit)[0]).toMatchObject({
    status: "indeterminate",
    sourceTrace: { max_length: 10 },
    measurement: { status: "indeterminate" },
  })
})
