import { expect, test } from "bun:test"
import type { PcbBoard, PcbTrace } from "circuit-json"
import { bend, board } from "../fixtures/pcb-bend-zones"
import { checkPcbBendZoneTraces } from "../../index"

test("checks wire segments adjacent to vias regardless of from_layer/to_layer direction and across inner-layer via spans", () => {
  const fourLayerFlexBoard: PcbBoard = {
    ...board,
    num_layers: 4,
  }

  const reversedViaOrder: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "reversed_via_order",
    route: [
      { route_type: "wire", x: 0, y: -4, layer: "top", width: 0.1 },
      { route_type: "via", x: 0, y: 0, from_layer: "bottom", to_layer: "top" },
    ],
  }

  const tappedInnerLayerVia: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "tapped_inner_layer_via",
    route: [
      { route_type: "via", x: 0, y: 0, from_layer: "top", to_layer: "bottom" },
      { route_type: "wire", x: 0, y: 4, layer: "inner1", width: 0.1 },
    ],
  }

  const unspannedBlindVia: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "unspanned_blind_via",
    route: [
      {
        route_type: "via",
        x: 0,
        y: 0,
        from_layer: "top",
        to_layer: "inner1",
      },
      { route_type: "wire", x: 0, y: 4, layer: "bottom", width: 0.1 },
    ],
  }

  const errors = checkPcbBendZoneTraces([
    fourLayerFlexBoard,
    bend,
    reversedViaOrder,
    tappedInnerLayerVia,
    unspannedBlindVia,
  ])

  expect(errors.map((e) => e.pcb_trace_id)).toEqual([
    "reversed_via_order",
    "tapped_inner_layer_via",
  ])
})

test("reports trace reversals inside a bend zone when bounded by a via or through_pad outside the zone", () => {
  const viaBoundedReversal: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "via_bounded_reversal",
    route: [
      { route_type: "via", x: -5, y: 1, from_layer: "bottom", to_layer: "top" },
      { route_type: "wire", x: 0, y: 1, layer: "top", width: 0.1 },
      { route_type: "wire", x: -5, y: 1, layer: "top", width: 0.1 },
    ],
  }

  const throughPadBoundedReversal: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "through_pad_bounded_reversal",
    route: [
      { route_type: "wire", x: -5, y: -2, layer: "top", width: 0.1 },
      { route_type: "wire", x: 0, y: -2, layer: "top", width: 0.1 },
      {
        route_type: "through_pad",
        start: { x: -5, y: -2 },
        end: { x: -6, y: -2 },
        start_layer: "top",
        end_layer: "bottom",
        width: 0.1,
      },
    ],
  }

  const errors = checkPcbBendZoneTraces([
    board,
    bend,
    viaBoundedReversal,
    throughPadBoundedReversal,
  ])

  expect(errors.map((e) => e.pcb_trace_id)).toEqual([
    "via_bounded_reversal",
    "through_pad_bounded_reversal",
  ])
  expect(errors.every((e) => e.message.includes("Trace corner"))).toBe(true)
})
