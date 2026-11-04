import { expect, test } from "bun:test"
import { checkEachPcbPortConnectedToPcbTraces } from "../../lib/check-each-pcb-port-connected-to-pcb-trace"
import { circuitJson } from "./near-zero-plated-slot-edge-fixture"

test.failing(
  "connectivity handles a native near-zero slot edge without altering input",
  () => {
    const before = structuredClone(circuitJson)
    expect(checkEachPcbPortConnectedToPcbTraces(circuitJson)).toEqual([])
    expect(circuitJson).toEqual(before)
  },
)
