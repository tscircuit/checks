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

test("routing pipeline emits the bus error", async () => {
  const circuit: AnyCircuitElement[] = [bus(), trace("a", 10), trace("b", 12)]
  expect(
    (await runAllRoutingChecks(circuit)).filter(
      (e) => e.type === "pcb_bus_length_skew_error",
    ),
  ).toEqual(checkPcbBusLengthSkew(circuit))
})
