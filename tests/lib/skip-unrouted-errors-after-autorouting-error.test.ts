import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkEachPcbPortConnectedToPcbTraces } from "lib/check-each-pcb-port-connected-to-pcb-trace"
import { checkSourceTracesHavePcbTraces } from "lib/check-source-traces-have-pcb-traces"
import { runAllRoutingChecks } from "lib/run-all-checks"

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
  {
    type: "pcb_autorouting_error",
    pcb_error_id: "pcb_autorouting_error_1",
    error_type: "pcb_autorouting_error",
    message: "Remaining routes left unrouted",
  },
]

const getUnroutedErrorTypes = (errors: AnyCircuitElement[]) =>
  errors
    .map((error) => error.type)
    .filter(
      (type) =>
        type === "pcb_port_not_connected_error" ||
        type === "pcb_trace_missing_error",
    )
    .sort()

test("unrouted connections are reported by default after an autorouting error", async () => {
  expect(
    checkEachPcbPortConnectedToPcbTraces(structuredClone(unroutedCircuitJson)),
  ).toHaveLength(1)
  expect(
    checkSourceTracesHavePcbTraces(structuredClone(unroutedCircuitJson)),
  ).toHaveLength(1)
  expect(
    getUnroutedErrorTypes(
      await runAllRoutingChecks(structuredClone(unroutedCircuitJson)),
    ),
  ).toEqual(["pcb_port_not_connected_error", "pcb_trace_missing_error"])
})

test("includeCascadingErrors: false drops unrouted errors explained by an autorouting error", async () => {
  expect(
    checkEachPcbPortConnectedToPcbTraces(structuredClone(unroutedCircuitJson), {
      includeCascadingErrors: false,
    }),
  ).toEqual([])
  expect(
    checkSourceTracesHavePcbTraces(structuredClone(unroutedCircuitJson), {
      includeCascadingErrors: false,
    }),
  ).toEqual([])
  expect(
    getUnroutedErrorTypes(
      await runAllRoutingChecks(structuredClone(unroutedCircuitJson), {
        includeCascadingErrors: false,
      }),
    ),
  ).toEqual([])
})

test("includeCascadingErrors: false keeps unrouted errors when routing did not fail", async () => {
  const circuitJson = structuredClone(unroutedCircuitJson).filter(
    (element) => element.type !== "pcb_autorouting_error",
  )

  expect(
    getUnroutedErrorTypes(
      await runAllRoutingChecks(circuitJson, { includeCascadingErrors: false }),
    ),
  ).toEqual(["pcb_port_not_connected_error", "pcb_trace_missing_error"])
})
