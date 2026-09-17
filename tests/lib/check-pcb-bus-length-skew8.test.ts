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

test("bus membership uses IDs and cannot leak between same-named subcircuits", () => {
  const buses = [
    {
      ...bus(0),
      name: "DATA",
      source_bus_id: "bus_left",
      subcircuit_id: "left",
    },
    {
      ...bus(0),
      name: "DATA",
      source_bus_id: "bus_right",
      source_trace_ids: ["c", "d"],
      subcircuit_id: "right",
    },
  ]
  expect(
    checkPcbBusLengthSkew([
      ...buses,
      trace("a", 10),
      trace("b", 10),
      trace("c", 20),
      trace("d", 22),
    ]),
  ).toEqual([
    expect.objectContaining({
      source_bus_id: "bus_right",
      subcircuit_id: "right",
      actual_length_skew: 2,
    }),
  ])
})
