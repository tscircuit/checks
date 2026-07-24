import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbTraceLengths, runAllRoutingChecks } from "../.."

const circuitJson = [
  {
    type: "source_trace",
    source_trace_id: "overlength_source_trace",
    connected_source_port_ids: [],
    connected_source_net_ids: ["signal_net"],
    max_length: 10,
    subcircuit_id: "board",
  },
  {
    type: "source_trace",
    source_trace_id: "short_source_trace",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    max_length: 10,
  },
  {
    type: "source_trace",
    source_trace_id: "unconstrained_source_trace",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    max_length: null,
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "overlength_pcb_trace",
    source_trace_id: "overlength_source_trace",
    subcircuit_id: "board",
    route: [
      { route_type: "wire", x: 0, y: 0, width: 0.15, layer: "top" },
      { route_type: "wire", x: 12, y: 0, width: 0.15, layer: "top" },
    ],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "short_pcb_trace",
    source_trace_id: "short_source_trace",
    trace_length: 8,
    route: [],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "unconstrained_pcb_trace",
    source_trace_id: "unconstrained_source_trace",
    trace_length: 20,
    route: [],
  },
] as AnyCircuitElement[]

test("warns when a PCB trace exceeds its source trace maximum length", () => {
  expect(checkPcbTraceLengths(circuitJson)).toEqual([
    {
      type: "pcb_trace_too_long_warning",
      pcb_trace_too_long_warning_id:
        "pcb_trace_too_long_warning_overlength_pcb_trace",
      warning_type: "pcb_trace_too_long_warning",
      message: "PCB trace is 12.00mm long, exceeding the 10mm maximum",
      pcb_trace_id: "overlength_pcb_trace",
      source_trace_id: "overlength_source_trace",
      source_net_id: "signal_net",
      actual_trace_length: 12,
      maximum_trace_length: 10,
      subcircuit_id: "board",
    },
  ])
})

test("is included in the routing check pipeline", async () => {
  const results = await runAllRoutingChecks(circuitJson)

  expect(
    results.filter((result) => result.type === "pcb_trace_too_long_warning"),
  ).toEqual(checkPcbTraceLengths(circuitJson))
})
