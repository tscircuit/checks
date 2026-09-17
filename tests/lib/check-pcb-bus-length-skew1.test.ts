import { expect, test } from "bun:test"
import {
  any_circuit_element,
  type AnyCircuitElement,
  type PcbTrace,
  type SourceBus,
} from "circuit-json"
import { checkPcbBusLengthSkew, runAllRoutingChecks } from "../.."
import { getPcbTraceLength } from "../../lib/util/get-pcb-trace-length"

import { bus, trace } from "../fixtures/length-matching"

test("reports a typed error with measured skew and member IDs", () => {
  const errors = checkPcbBusLengthSkew([bus(), trace("a", 10), trace("b", 12)])
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    source_bus_id: "bus",
    actual_length_skew: 2,
    maximum_length_skew: 1,
    source_trace_ids: ["a", "b"],
    pcb_trace_ids: ["pcb_a", "pcb_b"],
    subcircuit_id: "board",
  })
  expect(any_circuit_element.parse(errors[0])).toEqual(errors[0])
})
