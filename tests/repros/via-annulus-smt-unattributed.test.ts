import { expect, test } from "bun:test"
import { checkEachPcbPortConnectedToPcbTraces } from "../../lib/check-each-pcb-port-connected-to-pcb-trace"
import { lcdEscape } from "./via-annulus-smt-fixture"

test("a physically attached escape without source trace IDs still reaches the port", () => {
  const circuit = lcdEscape()
  for (const element of circuit) {
    if (element.type === "pcb_trace") delete element.source_trace_id
  }
  expect(checkEachPcbPortConnectedToPcbTraces(circuit)).toEqual([])
})
