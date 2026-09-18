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

test("measures wire, via, and through-pad segments without skipping or double counting", () => {
  const route: PcbTrace = {
    ...trace("a", 0),
    trace_length: undefined,
    route: [
      { route_type: "wire", x: 0, y: 0, layer: "top", width: 0.2 },
      { route_type: "via", x: 3, y: 4, from_layer: "top", to_layer: "bottom" },
      { route_type: "wire", x: 6, y: 8, layer: "bottom", width: 0.2 },
      {
        route_type: "through_pad",
        start: { x: 6, y: 8 },
        end: { x: 8, y: 8 },
        start_layer: "bottom",
        end_layer: "bottom",
        width: 1,
      },
      { route_type: "wire", x: 8, y: 11, layer: "bottom", width: 0.2 },
    ],
  }
  expect(getPcbTraceLength(route)).toBeCloseTo(16.6)
  expect(getPcbTraceLength({ ...route, trace_length: 20 })).toBe(20)
  expect(
    checkPcbBusLengthSkew([bus(), route, trace("b", 10)])[0]!
      .actual_length_skew,
  ).toBeCloseTo(6.6)
})
