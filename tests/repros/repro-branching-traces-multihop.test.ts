import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

/**
 * Multi-hop branching: 2 pads connected by 3 traces in series through 2
 * junction points. Only the first trace has source_trace_id.
 *
 *   Pad A (-6,0) ---trace1---> (-2,0) ---trace2---> (2,0) ---trace3---> Pad B (6,0)
 *
 * This simulates a route that passes through multiple intermediate points
 * (e.g. breakout boundary + routing waypoint).
 */
const circuitJson: AnyCircuitElement[] = [
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_0",
    center: { x: 0, y: 0 },
    width: 16,
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
    x: -6,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_b",
    source_port_id: "source_port_b",
    x: 6,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_a",
    pcb_port_id: "pcb_port_a",
    shape: "rect",
    x: -6,
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
    x: 6,
    y: 0,
    width: 1,
    height: 1,
    layer: "top",
  },
  // trace1: pad_A → junction1 (has source_trace_id)
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_1",
    source_trace_id: "source_trace_1",
    route: [
      {
        route_type: "wire",
        x: -6,
        y: 0,
        layer: "top",
        width: 0.2,
        start_pcb_port_id: "pcb_port_a",
      },
      { route_type: "wire", x: -2, y: 0, layer: "top", width: 0.2 },
    ],
  },
  // trace2: junction1 → junction2 (NO source_trace_id)
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_2",
    route: [
      { route_type: "wire", x: -2, y: 0, layer: "top", width: 0.2 },
      { route_type: "wire", x: 2, y: 0, layer: "top", width: 0.2 },
    ],
  },
  // trace3: junction2 → pad_B (NO source_trace_id)
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_3",
    route: [
      { route_type: "wire", x: 2, y: 0, layer: "top", width: 0.2 },
      {
        route_type: "wire",
        x: 6,
        y: 0,
        layer: "top",
        width: 0.2,
        end_pcb_port_id: "pcb_port_b",
      },
    ],
  },
] as AnyCircuitElement[]

test("multi-hop branching traces should not report false contiguity errors", () => {
  const traceErrors = checkTracesAreContiguous(circuitJson)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...traceErrors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)

  // BUG: should be 0 — these are false positives from branching traces
  // without source_trace_id not being recognized as connected
  expect(traceErrors).toHaveLength(4)
})
