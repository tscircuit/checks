import { expect, test } from "bun:test"
import type { PcbTrace } from "circuit-json"
import { board, bend, trace, traceIds } from "../fixtures/pcb-bend-zones"

test("uses outgoing trace widths, including the maximum width of a tapered segment", () => {
  const narrow: PcbTrace = {
    ...trace("narrow", [
      [1.05, -4],
      [1.05, 4],
    ]),
    route: [
      { route_type: "wire", x: 1.05, y: -4, layer: "top", width: 0.1 },
      // This width belongs to the next outgoing segment, not the incoming one.
      { route_type: "wire", x: 1.05, y: 4, layer: "top", width: 2 },
    ],
  }
  const tapered: PcbTrace = {
    ...narrow,
    pcb_trace_id: "tapered",
    route: [
      {
        route_type: "wire",
        x: 1.05,
        y: -4,
        layer: "top",
        width: 0.1,
        start_width: 0.1,
        end_width: 0.6,
        width_interpolation_mode: "linear",
      },
      narrow.route[1]!,
    ],
  }
  expect(traceIds([board, bend, narrow, tapered])).toEqual(["tapered"])
})
