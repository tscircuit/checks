import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkEachPcbPortConnectedToPcbTraces } from "lib/check-each-pcb-port-connected-to-pcb-trace"
import { checkSourceTracesHavePcbTraces } from "lib/check-source-traces-have-pcb-traces"

const unroutedCircuitJson: AnyCircuitElement[] = [
  {
    type: "pcb_port",
    pcb_port_id: "port1",
    source_port_id: "source1",
    x: 0,
    y: 0,
    pcb_component_id: "comp1",
    layers: ["top"],
  },
  {
    type: "pcb_port",
    pcb_port_id: "port2",
    source_port_id: "source2",
    x: 4,
    y: 4,
    pcb_component_id: "comp2",
    layers: ["top"],
  },
  {
    type: "source_trace",
    source_trace_id: "trace1",
    connected_source_port_ids: ["source1", "source2"],
    connected_source_net_ids: [],
  },
]

const autoroutingError: AnyCircuitElement = {
  type: "pcb_autorouting_error",
  pcb_error_id: "pcb_autorouting_error_1",
  error_type: "pcb_autorouting_error",
  message: "Remaining routes left unrouted",
}

test("unrouted connections are reported when routing did not fail", () => {
  expect(
    checkEachPcbPortConnectedToPcbTraces(structuredClone(unroutedCircuitJson)),
  ).toHaveLength(1)
  expect(
    checkSourceTracesHavePcbTraces(structuredClone(unroutedCircuitJson)),
  ).toHaveLength(1)
})

test("an autorouting error replaces the per-port and per-trace unrouted errors", () => {
  const circuitJson = [
    ...structuredClone(unroutedCircuitJson),
    autoroutingError,
  ]

  expect(checkEachPcbPortConnectedToPcbTraces(circuitJson)).toEqual([])
  expect(checkSourceTracesHavePcbTraces(circuitJson)).toEqual([])
})
