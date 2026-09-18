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

test("accepts equality, zero skew, and floating-point boundary noise", () => {
  expect(
    checkPcbBusLengthSkew([bus(), trace("a", 10), trace("b", 11)]),
  ).toEqual([])
  expect(
    checkPcbBusLengthSkew([bus(0), trace("a", 10), trace("b", 10)]),
  ).toEqual([])
  expect(
    checkPcbBusLengthSkew([bus(0.1), trace("a", 0.2), trace("b", 0.3)]),
  ).toEqual([])
  expect(
    checkPcbBusLengthSkew([bus(0), trace("a", 10), trace("b", 10.01)]),
  ).toHaveLength(1)
})
