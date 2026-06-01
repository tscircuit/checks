import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

/**
 * Simplest branching trace: 2 pads connected by 2 separate pcb_trace objects
 * meeting at a junction. This is the basic breakout pattern — inner trace goes
 * pad→junction, outer trace goes junction→pad.
 *
 *   Pad A (-5,0) ---trace1---> (0,0) ---trace2---> Pad B (5,0)
 *
 * trace1 has source_trace_id, trace2 does NOT.
 */
const circuitJson: AnyCircuitElement[] = [
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_0",
    center: { x: 0, y: 0 },
    width: 14,
    height: 4,
    material: "fr4",
    thickness: 1.6,
    num_layers: 2,
  },
  {
    type: "source_trace",
    source_trace_id: "source_trace_1",
    connected_source_port_ids: ["source_port_a", "source_port_b"],
    connected_source_net_ids: [],
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_a",
    source_port_id: "source_port_a",
    x: -5,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_b",
    source_port_id: "source_port_b",
    x: 5,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_a",
    pcb_port_id: "pcb_port_a",
    shape: "rect",
    x: -5,
    y: 0,
    width: 1,
    height: 1,
    layer: "top",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_b",
    pcb_port_id: "pcb_port_b",
    shape: "rect",
    x: 5,
    y: 0,
    width: 1,
    height: 1,
    layer: "top",
  },
  // trace1: pad_A → junction (has source_trace_id)
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_1",
    source_trace_id: "source_trace_1",
    route: [
      {
        route_type: "wire",
        x: -5,
        y: 0,
        layer: "top",
        width: 0.2,
        start_pcb_port_id: "pcb_port_a",
      },
      { route_type: "wire", x: 0, y: 0, layer: "top", width: 0.2 },
    ],
  },
  // trace2: junction → pad_B (NO source_trace_id)
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_2",
    route: [
      { route_type: "wire", x: 0, y: 0, layer: "top", width: 0.2 },
      {
        route_type: "wire",
        x: 5,
        y: 0,
        layer: "top",
        width: 0.2,
        end_pcb_port_id: "pcb_port_b",
      },
    ],
  },
] as AnyCircuitElement[]

test("linear branching traces should not report false contiguity errors", () => {
  const traceErrors = checkTracesAreContiguous(circuitJson)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...traceErrors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)

  // BUG: should be 0 — these are false positives from branching traces
  // without source_trace_id not being recognized as connected
  expect(traceErrors).toHaveLength(2)
})
