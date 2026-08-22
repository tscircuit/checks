import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

const getViaTransitionErrorIds = (route: PcbTrace["route"]): string[] => {
  const circuitJson = [
    {
      type: "pcb_board",
      pcb_board_id: "pcb_board_1",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      thickness: 1.6,
      num_layers: 4,
      material: "fr4",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_1",
      source_trace_id: "source_trace_1",
      route,
    },
  ] as AnyCircuitElement[]

  return checkTracesAreContiguous(circuitJson)
    .map((error) => error.pcb_trace_error_id)
    .filter(
      (errorId) =>
        errorId.startsWith("unconnected_via_") ||
        errorId.startsWith("misaligned_via_") ||
        errorId.startsWith("via_layer_mismatch_"),
    )
}

test("validates copper continuity around physical via spans", () => {
  const reversedViaSpanRoute: PcbTrace["route"] = [
    { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
    { route_type: "wire", x: 1, y: 0, width: 0.2, layer: "top" },
    {
      route_type: "via",
      x: 1,
      y: 0,
      from_layer: "bottom",
      to_layer: "top",
    },
    { route_type: "wire", x: 1, y: 0, width: 0.2, layer: "bottom" },
    { route_type: "wire", x: 2, y: 0, width: 0.2, layer: "bottom" },
  ]

  expect(getViaTransitionErrorIds(reversedViaSpanRoute)).toEqual([])

  const innerLayerTapOnThroughViaRoute: PcbTrace["route"] = [
    { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
    { route_type: "wire", x: 1, y: 0, width: 0.2, layer: "top" },
    {
      route_type: "via",
      x: 1,
      y: 0,
      from_layer: "top",
      to_layer: "bottom",
    },
    { route_type: "wire", x: 1, y: 0, width: 0.2, layer: "inner1" },
    { route_type: "wire", x: 2, y: 0, width: 0.2, layer: "inner1" },
  ]

  expect(getViaTransitionErrorIds(innerLayerTapOnThroughViaRoute)).toEqual([])

  const consecutiveViaRoute: PcbTrace["route"] = [
    { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
    { route_type: "wire", x: 1, y: 0, width: 0.2, layer: "top" },
    {
      route_type: "via",
      x: 1,
      y: 0,
      from_layer: "top",
      to_layer: "bottom",
    },
    {
      route_type: "via",
      x: 2,
      y: 0,
      from_layer: "bottom",
      to_layer: "top",
    },
    { route_type: "wire", x: 2, y: 0, width: 0.2, layer: "top" },
    { route_type: "wire", x: 3, y: 0, width: 0.2, layer: "top" },
  ]

  expect(getViaTransitionErrorIds(consecutiveViaRoute)).toEqual([
    "unconnected_via_pcb_trace_1_2",
    "unconnected_via_pcb_trace_1_3",
  ])

  const outsideViaSpanRoute: PcbTrace["route"] = [
    { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
    { route_type: "wire", x: 1, y: 0, width: 0.2, layer: "top" },
    {
      route_type: "via",
      x: 1,
      y: 0,
      from_layer: "inner1",
      to_layer: "bottom",
    },
    { route_type: "wire", x: 1, y: 0, width: 0.2, layer: "inner1" },
    { route_type: "wire", x: 2, y: 0, width: 0.2, layer: "inner1" },
  ]

  expect(getViaTransitionErrorIds(outsideViaSpanRoute)).toEqual([
    "via_layer_mismatch_pcb_trace_1_2",
  ])
})
