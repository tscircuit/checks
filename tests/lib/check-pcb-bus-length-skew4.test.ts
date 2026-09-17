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

test("sums fragments once per member and ignores unrelated traces", () => {
  expect(
    checkPcbBusLengthSkew([
      { ...bus(0), source_trace_ids: ["a", "b", "a"] },
      trace("a", 4),
      { ...trace("a", 6), pcb_trace_id: "pcb_a_part2" },
      trace("b", 10),
      trace("unrelated", 100),
    ]),
  ).toEqual([])
})
