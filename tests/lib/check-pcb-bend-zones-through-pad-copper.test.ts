import { expect, test } from "bun:test"
import type { PcbTrace, PcbTraceRoutePointThroughPad } from "circuit-json"
import { board, bend, pad, trace, traceIds } from "../fixtures/pcb-bend-zones"

test("checks incoming and outgoing through-pad copper using the matching face", () => {
  const throughPad: PcbTraceRoutePointThroughPad = {
    route_type: "through_pad",
    start: { x: 5, y: 0 },
    end: { x: 6, y: 0 },
    start_layer: "top",
    end_layer: "bottom",
    width: 0.1,
  }
  const incoming: PcbTrace = {
    ...trace("incoming", []),
    route: [
      { route_type: "wire", x: 0, y: -5, layer: "top", width: 0.1 },
      throughPad,
    ],
  }
  const outgoing: PcbTrace = {
    ...trace("outgoing", []),
    route: [
      throughPad,
      { route_type: "wire", x: 0, y: -5, layer: "bottom", width: 0.1 },
    ],
  }
  const oppositeFace: PcbTrace = {
    ...trace("opposite_face", []),
    route: [
      { ...throughPad, start: { x: -5, y: -5 }, end: { x: -5, y: 5 } },
      { route_type: "wire", x: 5, y: 5, layer: "bottom", width: 0.1 },
    ],
  }
  expect(traceIds([board, bend, incoming, outgoing, oppositeFace])).toEqual([
    "incoming",
    "outgoing",
  ])
})
