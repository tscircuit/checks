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

test("skips unconstrained, unrouted, and single-member buses", () => {
  const unconstrained = bus()
  delete unconstrained.max_length_skew
  expect(
    checkPcbBusLengthSkew([unconstrained, trace("a", 1), trace("b", 20)]),
  ).toEqual([])
  expect(checkPcbBusLengthSkew([bus(), trace("a", 10)])).toEqual([])
  expect(
    checkPcbBusLengthSkew([
      bus(),
      trace("a", 10),
      { ...trace("b", 0), trace_length: undefined },
    ]),
  ).toEqual([])
  expect(
    checkPcbBusLengthSkew([
      { ...bus(), source_trace_ids: ["a", "a"] },
      trace("a", 10),
    ]),
  ).toEqual([])
})
