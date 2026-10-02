import { expect, test } from "bun:test"
import type { PcbTrace } from "circuit-json"
import { board, bend, via } from "../fixtures/pcb-bend-zones"
import { checkPcbBendZoneTraces } from "../../index"

test("checks segments adjacent to vias and treats layer changes as route boundaries", () => {
  const routed: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "wire_to_via",
    source_trace_id: "source_trace",
    route: [
      { route_type: "wire", x: 0, y: -4, layer: "top", width: 0.1 },
      { route_type: "via", x: 0, y: 0, from_layer: "top", to_layer: "bottom" },
      { route_type: "wire", x: 5, y: 0, layer: "bottom", width: 0.1 },
    ],
  }
  const changedLayer: PcbTrace = {
    ...routed,
    pcb_trace_id: "layer_jump",
    route: [
      { route_type: "wire", x: 0, y: -4, layer: "top", width: 0.1 },
      { route_type: "wire", x: 0, y: 0, layer: "bottom", width: 0.1 },
      { route_type: "wire", x: 5, y: 0, layer: "bottom", width: 0.1 },
    ],
  }
  const errors = checkPcbBendZoneTraces([board, bend, routed, changedLayer])
  expect(errors).toHaveLength(1)
  expect(errors[0]?.pcb_trace_id).toBe("wire_to_via")
  expect(errors[0]?.source_trace_id).toBe("source_trace")
})
