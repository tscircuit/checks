import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkDifferentNetViaSpacing } from "lib/check-different-net-via-spacing"
import { checkEachPcbPortConnectedToPcbTraces } from "lib/check-each-pcb-port-connected-to-pcb-trace"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import { checkViasOffBoard } from "lib/check-pcb-components-out-of-board/checkViasOffBoard"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"
import { checkPinMustBeConnected } from "lib/check-pin-must-be-connected"
import { checkSameNetViaSpacing } from "lib/check-same-net-via-spacing"
import { checkSourceTracesHavePcbTraces } from "lib/check-source-traces-have-pcb-traces"
import { checkPcbTracesOutOfBoard } from "lib/check-trace-out-of-board/checkTraceOutOfBoard"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

/**
 * Helper function to verify that exactly 2 errors are returned,
 * with one error from each board (board 1 and board 2).
 *
 * @param errors - Array of DRC errors
 * @param getBoardId - Function to extract a board identifier string from an error.
 *                     The identifier should contain "_b1" for board 1 or "_b2" for board 2.
 */
function expectExactlyOneErrorPerBoard<T>(
  errors: T[],
  getBoardId: (error: T) => string,
): void {
  expect(errors.length).toBe(2)
  const boardIds = errors.map(getBoardId)
  expect(boardIds.some((id) => id.includes("_b1"))).toBe(true)
  expect(boardIds.some((id) => id.includes("_b2"))).toBe(true)
}

/**
 * Panel with 2 boards, each board has exactly 1 of each DRC error type.
 *
 * Board 1: center at (-20, 0), size 20x20 (extends from x=-30 to x=-10)
 * Board 2: center at (20, 0), size 20x20 (extends from x=10 to x=30)
 *
 * All 11 DRC checks are tested:
 * 1. checkPcbComponentsOutOfBoard - Component outside board bounds
 * 2. checkViasOffBoard - Via outside board bounds
 * 3. checkPcbTracesOutOfBoard - Trace too close to board edge
 * 4. checkPcbComponentOverlap - Overlapping pads
 * 5. checkEachPcbTraceNonOverlapping - Overlapping traces
 * 6. checkDifferentNetViaSpacing - Different net vias too close
 * 7. checkSameNetViaSpacing - Same net vias too close
 * 8. checkEachPcbPortConnectedToPcbTraces - Ports not connected
 * 9. checkTracesAreContiguous - Trace not connected to pad
 * 10. checkSourceTracesHavePcbTraces - Source trace missing PCB trace
 * 11. checkPinMustBeConnected - Pin must be connected but floating
 */
const panelCircuitJson: AnyCircuitElement[] = [
  // ============================================================
  // SOURCE GROUPS & BOARDS STRUCTURE
  // ============================================================
  {
    type: "source_group",
    source_group_id: "sg_board1_inner",
    parent_source_group_id: "sg_board1",
  },
  {
    type: "source_group",
    source_group_id: "sg_board1",
    is_subcircuit: true,
    subcircuit_id: "subcircuit_b1",
    parent_source_group_id: "sg_panel",
  },
  {
    type: "source_group",
    source_group_id: "sg_board2_inner",
    parent_source_group_id: "sg_board2",
  },
  {
    type: "source_group",
    source_group_id: "sg_board2",
    is_subcircuit: true,
    subcircuit_id: "subcircuit_b2",
    parent_source_group_id: "sg_panel",
  },
  {
    type: "source_group",
    source_group_id: "sg_panel",
    is_subcircuit: true,
    subcircuit_id: "subcircuit_panel",
  },
  {
    type: "source_board",
    source_board_id: "src_board_1",
    source_group_id: "sg_board1",
  },
  {
    type: "source_board",
    source_board_id: "src_board_2",
    source_group_id: "sg_board2",
  },

  // ============================================================
  // PCB BOARDS
  // ============================================================
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_1",
    source_board_id: "src_board_1",
    center: { x: -20, y: 0 },
    thickness: 1.4,
    num_layers: 2,
    width: 20,
    height: 20,
    material: "fr4",
  },
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_2",
    source_board_id: "src_board_2",
    center: { x: 20, y: 0 },
    thickness: 1.4,
    num_layers: 2,
    width: 20,
    height: 20,
    material: "fr4",
  },

  // ============================================================
  // ERROR 1: COMPONENT OUTSIDE BOARD (checkPcbComponentsOutOfBoard)
  // ============================================================
  // Board 1: component at x=-35 (outside board bounds -30 to -10)
  {
    type: "source_component",
    source_component_id: "src_comp_out_b1",
    ftype: "simple_resistor",
    name: "R_out_b1",
    resistance: 1000,
    source_group_id: "sg_board1_inner",
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_comp_out_b1",
    center: { x: -35, y: 0 },
    width: 2,
    height: 1,
    layer: "top",
    rotation: 0,
    source_component_id: "src_comp_out_b1",
    subcircuit_id: "subcircuit_b1",
  },
  // Board 2: component at x=35 (outside board bounds 10 to 30)
  {
    type: "source_component",
    source_component_id: "src_comp_out_b2",
    ftype: "simple_resistor",
    name: "R_out_b2",
    resistance: 1000,
    source_group_id: "sg_board2_inner",
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_comp_out_b2",
    center: { x: 35, y: 0 },
    width: 2,
    height: 1,
    layer: "top",
    rotation: 0,
    source_component_id: "src_comp_out_b2",
    subcircuit_id: "subcircuit_b2",
  },

  // ============================================================
  // ERROR 2: VIA OUTSIDE BOARD (checkViasOffBoard)
  // ============================================================
  // Board 1: via at x=-35
  {
    type: "pcb_via",
    pcb_via_id: "via_out_b1",
    x: -35,
    y: 5,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
    subcircuit_id: "subcircuit_b1",
  },
  // Board 2: via at x=35
  {
    type: "pcb_via",
    pcb_via_id: "via_out_b2",
    x: 35,
    y: 5,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
    subcircuit_id: "subcircuit_b2",
  },

  // ============================================================
  // ERROR 3: TRACE TOO CLOSE TO BOARD EDGE (checkPcbTracesOutOfBoard)
  // ============================================================
  // Board 1: trace at x=-29.95 (edge is at x=-30, margin is 0.2)
  {
    type: "source_trace",
    source_trace_id: "src_trace_edge_b1",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    subcircuit_id: "subcircuit_b1",
    display_name: "trace_edge_b1",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_edge_b1",
    source_trace_id: "src_trace_edge_b1",
    subcircuit_id: "subcircuit_b1",
    route: [
      { route_type: "wire", x: -29.95, y: 0, width: 0.2, layer: "top" },
      { route_type: "wire", x: -29.95, y: 2, width: 0.2, layer: "top" },
    ],
  },
  // Board 2: trace at x=29.95 (edge is at x=30)
  {
    type: "source_trace",
    source_trace_id: "src_trace_edge_b2",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    subcircuit_id: "subcircuit_b2",
    display_name: "trace_edge_b2",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_edge_b2",
    source_trace_id: "src_trace_edge_b2",
    subcircuit_id: "subcircuit_b2",
    route: [
      { route_type: "wire", x: 29.95, y: 0, width: 0.2, layer: "top" },
      { route_type: "wire", x: 29.95, y: 2, width: 0.2, layer: "top" },
    ],
  },

  // ============================================================
  // ERROR 4: OVERLAPPING PADS (checkPcbComponentOverlap)
  // ============================================================
  // Board 1: two pads at same location (-20, 5)
  {
    type: "source_component",
    source_component_id: "src_overlap1_b1",
    ftype: "simple_chip",
    name: "U_ov1_b1",
    source_group_id: "sg_board1_inner",
  },
  {
    type: "source_component",
    source_component_id: "src_overlap2_b1",
    ftype: "simple_chip",
    name: "U_ov2_b1",
    source_group_id: "sg_board1_inner",
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_overlap1_b1",
    center: { x: -20, y: 5 },
    width: 2,
    height: 2,
    layer: "top",
    rotation: 0,
    source_component_id: "src_overlap1_b1",
    subcircuit_id: "subcircuit_b1",
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_overlap2_b1",
    center: { x: -20, y: 5 },
    width: 2,
    height: 2,
    layer: "top",
    rotation: 0,
    source_component_id: "src_overlap2_b1",
    subcircuit_id: "subcircuit_b1",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad_ov1_b1",
    pcb_component_id: "pcb_overlap1_b1",
    layer: "top",
    shape: "rect",
    width: 1,
    height: 1,
    x: -20,
    y: 5,
    subcircuit_id: "subcircuit_b1",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad_ov2_b1",
    pcb_component_id: "pcb_overlap2_b1",
    layer: "top",
    shape: "rect",
    width: 1,
    height: 1,
    x: -20,
    y: 5,
    subcircuit_id: "subcircuit_b1",
  },
  // Board 2: two pads at same location (20, 5)
  {
    type: "source_component",
    source_component_id: "src_overlap1_b2",
    ftype: "simple_chip",
    name: "U_ov1_b2",
    source_group_id: "sg_board2_inner",
  },
  {
    type: "source_component",
    source_component_id: "src_overlap2_b2",
    ftype: "simple_chip",
    name: "U_ov2_b2",
    source_group_id: "sg_board2_inner",
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_overlap1_b2",
    center: { x: 20, y: 5 },
    width: 2,
    height: 2,
    layer: "top",
    rotation: 0,
    source_component_id: "src_overlap1_b2",
    subcircuit_id: "subcircuit_b2",
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_overlap2_b2",
    center: { x: 20, y: 5 },
    width: 2,
    height: 2,
    layer: "top",
    rotation: 0,
    source_component_id: "src_overlap2_b2",
    subcircuit_id: "subcircuit_b2",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad_ov1_b2",
    pcb_component_id: "pcb_overlap1_b2",
    layer: "top",
    shape: "rect",
    width: 1,
    height: 1,
    x: 20,
    y: 5,
    subcircuit_id: "subcircuit_b2",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad_ov2_b2",
    pcb_component_id: "pcb_overlap2_b2",
    layer: "top",
    shape: "rect",
    width: 1,
    height: 1,
    x: 20,
    y: 5,
    subcircuit_id: "subcircuit_b2",
  },

  // ============================================================
  // ERROR 5: OVERLAPPING TRACES (checkEachPcbTraceNonOverlapping)
  // ============================================================
  // Board 1: two crossing traces at (-20, -5)
  {
    type: "source_trace",
    source_trace_id: "src_trace_ov1_b1",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    subcircuit_id: "subcircuit_b1",
    display_name: "trace_ov1_b1",
  },
  {
    type: "source_trace",
    source_trace_id: "src_trace_ov2_b1",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    subcircuit_id: "subcircuit_b1",
    display_name: "trace_ov2_b1",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_ov1_b1",
    source_trace_id: "src_trace_ov1_b1",
    subcircuit_id: "subcircuit_b1",
    route: [
      { route_type: "wire", x: -22, y: -5, width: 0.2, layer: "top" },
      { route_type: "wire", x: -18, y: -5, width: 0.2, layer: "top" },
    ],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_ov2_b1",
    source_trace_id: "src_trace_ov2_b1",
    subcircuit_id: "subcircuit_b1",
    route: [
      { route_type: "wire", x: -20, y: -7, width: 0.2, layer: "top" },
      { route_type: "wire", x: -20, y: -3, width: 0.2, layer: "top" },
    ],
  },
  // Board 2: two crossing traces at (20, -5)
  {
    type: "source_trace",
    source_trace_id: "src_trace_ov1_b2",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    subcircuit_id: "subcircuit_b2",
    display_name: "trace_ov1_b2",
  },
  {
    type: "source_trace",
    source_trace_id: "src_trace_ov2_b2",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    subcircuit_id: "subcircuit_b2",
    display_name: "trace_ov2_b2",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_ov1_b2",
    source_trace_id: "src_trace_ov1_b2",
    subcircuit_id: "subcircuit_b2",
    route: [
      { route_type: "wire", x: 18, y: -5, width: 0.2, layer: "top" },
      { route_type: "wire", x: 22, y: -5, width: 0.2, layer: "top" },
    ],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_ov2_b2",
    source_trace_id: "src_trace_ov2_b2",
    subcircuit_id: "subcircuit_b2",
    route: [
      { route_type: "wire", x: 20, y: -7, width: 0.2, layer: "top" },
      { route_type: "wire", x: 20, y: -3, width: 0.2, layer: "top" },
    ],
  },

  // ============================================================
  // ERROR 6: DIFFERENT NET VIAS TOO CLOSE (checkDifferentNetViaSpacing)
  // ============================================================
  // Board 1: two vias 0.2mm apart at (-15, -8) - not connected so different net
  {
    type: "pcb_via",
    pcb_via_id: "via_diff_close1_b1",
    x: -15,
    y: -8,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
    subcircuit_id: "subcircuit_b1",
  },
  {
    type: "pcb_via",
    pcb_via_id: "via_diff_close2_b1",
    x: -15.2,
    y: -8,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
    subcircuit_id: "subcircuit_b1",
  },
  // Board 2: two vias 0.2mm apart at (15, -8)
  {
    type: "pcb_via",
    pcb_via_id: "via_diff_close1_b2",
    x: 15,
    y: -8,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
    subcircuit_id: "subcircuit_b2",
  },
  {
    type: "pcb_via",
    pcb_via_id: "via_diff_close2_b2",
    x: 15.2,
    y: -8,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
    subcircuit_id: "subcircuit_b2",
  },

  // ============================================================
  // ERROR 7: SAME NET VIAS TOO CLOSE (checkSameNetViaSpacing)
  // Vias connected to the same trace (same net) that are too close
  // ============================================================
  // Board 1: two vias on same trace, 0.1mm apart (gap after subtracting outer_diameter)
  // Via outer_diameter = 0.6, so gap = distance - 0.6 = 0.7 - 0.6 = 0.1mm < 0.2mm default
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_same_net_b1",
    source_trace_id: "src_trace_same_net_b1",
    subcircuit_id: "subcircuit_b1",
    route: [],
  },
  {
    type: "source_trace",
    source_trace_id: "src_trace_same_net_b1",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    subcircuit_id: "subcircuit_b1",
    display_name: "trace_same_net_b1",
  },
  {
    type: "pcb_via",
    pcb_via_id: "via_same_close1_b1",
    pcb_trace_id: "pcb_trace_same_net_b1",
    x: -25,
    y: -3,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
    subcircuit_id: "subcircuit_b1",
  },
  {
    type: "pcb_via",
    pcb_via_id: "via_same_close2_b1",
    pcb_trace_id: "pcb_trace_same_net_b1",
    x: -24.3,
    y: -3,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
    subcircuit_id: "subcircuit_b1",
  },
  // Board 2: two vias on same trace, 0.1mm apart
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_same_net_b2",
    source_trace_id: "src_trace_same_net_b2",
    subcircuit_id: "subcircuit_b2",
    route: [],
  },
  {
    type: "source_trace",
    source_trace_id: "src_trace_same_net_b2",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    subcircuit_id: "subcircuit_b2",
    display_name: "trace_same_net_b2",
  },
  {
    type: "pcb_via",
    pcb_via_id: "via_same_close1_b2",
    pcb_trace_id: "pcb_trace_same_net_b2",
    x: 25,
    y: -3,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
    subcircuit_id: "subcircuit_b2",
  },
  {
    type: "pcb_via",
    pcb_via_id: "via_same_close2_b2",
    pcb_trace_id: "pcb_trace_same_net_b2",
    x: 25.7,
    y: -3,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
    subcircuit_id: "subcircuit_b2",
  },

  // ============================================================
  // ERROR 7: PCB PORTS NOT CONNECTED (checkEachPcbPortConnectedToPcbTraces)
  // Two ports on different components that should be connected but have no trace
  // ============================================================
  // Board 1
  {
    type: "source_component",
    source_component_id: "src_unconnected1_b1",
    ftype: "simple_resistor",
    name: "R_unconn1_b1",
    resistance: 1000,
    source_group_id: "sg_board1_inner",
  },
  {
    type: "source_port",
    source_port_id: "src_port_unconn1_b1",
    name: "pin1",
    pin_number: 1,
    port_hints: ["1"],
    source_component_id: "src_unconnected1_b1",
    subcircuit_id: "subcircuit_b1",
  },
  {
    type: "source_component",
    source_component_id: "src_unconnected2_b1",
    ftype: "simple_resistor",
    name: "R_unconn2_b1",
    resistance: 1000,
    source_group_id: "sg_board1_inner",
  },
  {
    type: "source_port",
    source_port_id: "src_port_unconn2_b1",
    name: "pin1",
    pin_number: 1,
    port_hints: ["1"],
    source_component_id: "src_unconnected2_b1",
    subcircuit_id: "subcircuit_b1",
  },
  {
    type: "source_trace",
    source_trace_id: "src_trace_unconn_b1",
    connected_source_port_ids: ["src_port_unconn1_b1", "src_port_unconn2_b1"],
    connected_source_net_ids: [],
    subcircuit_id: "subcircuit_b1",
    display_name: "trace_unconn_b1",
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_unconn1_b1",
    center: { x: -20, y: 8 },
    width: 2,
    height: 1,
    layer: "top",
    rotation: 0,
    source_component_id: "src_unconnected1_b1",
    subcircuit_id: "subcircuit_b1",
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_unconn2_b1",
    center: { x: -16, y: 8 },
    width: 2,
    height: 1,
    layer: "top",
    rotation: 0,
    source_component_id: "src_unconnected2_b1",
    subcircuit_id: "subcircuit_b1",
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_unconn1_b1",
    pcb_component_id: "pcb_unconn1_b1",
    layers: ["top"],
    x: -20,
    y: 8,
    source_port_id: "src_port_unconn1_b1",
    subcircuit_id: "subcircuit_b1",
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_unconn2_b1",
    pcb_component_id: "pcb_unconn2_b1",
    layers: ["top"],
    x: -16,
    y: 8,
    source_port_id: "src_port_unconn2_b1",
    subcircuit_id: "subcircuit_b1",
  },
  // Board 2
  {
    type: "source_component",
    source_component_id: "src_unconnected1_b2",
    ftype: "simple_resistor",
    name: "R_unconn1_b2",
    resistance: 1000,
    source_group_id: "sg_board2_inner",
  },
  {
    type: "source_port",
    source_port_id: "src_port_unconn1_b2",
    name: "pin1",
    pin_number: 1,
    port_hints: ["1"],
    source_component_id: "src_unconnected1_b2",
    subcircuit_id: "subcircuit_b2",
  },
  {
    type: "source_component",
    source_component_id: "src_unconnected2_b2",
    ftype: "simple_resistor",
    name: "R_unconn2_b2",
    resistance: 1000,
    source_group_id: "sg_board2_inner",
  },
  {
    type: "source_port",
    source_port_id: "src_port_unconn2_b2",
    name: "pin1",
    pin_number: 1,
    port_hints: ["1"],
    source_component_id: "src_unconnected2_b2",
    subcircuit_id: "subcircuit_b2",
  },
  {
    type: "source_trace",
    source_trace_id: "src_trace_unconn_b2",
    connected_source_port_ids: ["src_port_unconn1_b2", "src_port_unconn2_b2"],
    connected_source_net_ids: [],
    subcircuit_id: "subcircuit_b2",
    display_name: "trace_unconn_b2",
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_unconn1_b2",
    center: { x: 20, y: 8 },
    width: 2,
    height: 1,
    layer: "top",
    rotation: 0,
    source_component_id: "src_unconnected1_b2",
    subcircuit_id: "subcircuit_b2",
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_unconn2_b2",
    center: { x: 24, y: 8 },
    width: 2,
    height: 1,
    layer: "top",
    rotation: 0,
    source_component_id: "src_unconnected2_b2",
    subcircuit_id: "subcircuit_b2",
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_unconn1_b2",
    pcb_component_id: "pcb_unconn1_b2",
    layers: ["top"],
    x: 20,
    y: 8,
    source_port_id: "src_port_unconn1_b2",
    subcircuit_id: "subcircuit_b2",
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_unconn2_b2",
    pcb_component_id: "pcb_unconn2_b2",
    layers: ["top"],
    x: 24,
    y: 8,
    source_port_id: "src_port_unconn2_b2",
    subcircuit_id: "subcircuit_b2",
  },

  // ============================================================
  // ERROR 8: TRACE NOT CONTIGUOUS (checkTracesAreContiguous)
  // Trace endpoint not connected to any pad
  // ============================================================
  // Board 1
  {
    type: "source_trace",
    source_trace_id: "src_trace_discon_b1",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    subcircuit_id: "subcircuit_b1",
    display_name: "trace_discon_b1",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_discon_b1",
    source_trace_id: "src_trace_discon_b1",
    subcircuit_id: "subcircuit_b1",
    route: [
      { route_type: "wire", x: -28, y: 8, width: 0.2, layer: "top" },
      { route_type: "wire", x: -26, y: 8, width: 0.2, layer: "top" },
    ],
  },
  // Board 2
  {
    type: "source_trace",
    source_trace_id: "src_trace_discon_b2",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    subcircuit_id: "subcircuit_b2",
    display_name: "trace_discon_b2",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_discon_b2",
    source_trace_id: "src_trace_discon_b2",
    subcircuit_id: "subcircuit_b2",
    route: [
      { route_type: "wire", x: 26, y: 8, width: 0.2, layer: "top" },
      { route_type: "wire", x: 28, y: 8, width: 0.2, layer: "top" },
    ],
  },

  // ============================================================
  // ERROR 9: SOURCE TRACE MISSING PCB TRACE (checkSourceTracesHavePcbTraces)
  // Source trace with connected ports but no PCB trace
  // ============================================================
  // Board 1
  {
    type: "source_component",
    source_component_id: "src_missing_trace1_b1",
    ftype: "simple_resistor",
    name: "R_missing1_b1",
    resistance: 1000,
    source_group_id: "sg_board1_inner",
  },
  {
    type: "source_port",
    source_port_id: "src_port_missing1_b1",
    name: "pin1",
    pin_number: 1,
    port_hints: ["1"],
    source_component_id: "src_missing_trace1_b1",
    subcircuit_id: "subcircuit_b1",
  },
  {
    type: "source_component",
    source_component_id: "src_missing_trace2_b1",
    ftype: "simple_resistor",
    name: "R_missing2_b1",
    resistance: 1000,
    source_group_id: "sg_board1_inner",
  },
  {
    type: "source_port",
    source_port_id: "src_port_missing2_b1",
    name: "pin1",
    pin_number: 1,
    port_hints: ["1"],
    source_component_id: "src_missing_trace2_b1",
    subcircuit_id: "subcircuit_b1",
  },
  {
    type: "source_trace",
    source_trace_id: "src_trace_missing_b1",
    connected_source_port_ids: ["src_port_missing1_b1", "src_port_missing2_b1"],
    connected_source_net_ids: [],
    subcircuit_id: "subcircuit_b1",
    display_name: "trace_missing_b1",
  },
  // No pcb_trace for this source_trace!
  // Board 2
  {
    type: "source_component",
    source_component_id: "src_missing_trace1_b2",
    ftype: "simple_resistor",
    name: "R_missing1_b2",
    resistance: 1000,
    source_group_id: "sg_board2_inner",
  },
  {
    type: "source_port",
    source_port_id: "src_port_missing1_b2",
    name: "pin1",
    pin_number: 1,
    port_hints: ["1"],
    source_component_id: "src_missing_trace1_b2",
    subcircuit_id: "subcircuit_b2",
  },
  {
    type: "source_component",
    source_component_id: "src_missing_trace2_b2",
    ftype: "simple_resistor",
    name: "R_missing2_b2",
    resistance: 1000,
    source_group_id: "sg_board2_inner",
  },
  {
    type: "source_port",
    source_port_id: "src_port_missing2_b2",
    name: "pin1",
    pin_number: 1,
    port_hints: ["1"],
    source_component_id: "src_missing_trace2_b2",
    subcircuit_id: "subcircuit_b2",
  },
  {
    type: "source_trace",
    source_trace_id: "src_trace_missing_b2",
    connected_source_port_ids: ["src_port_missing1_b2", "src_port_missing2_b2"],
    connected_source_net_ids: [],
    subcircuit_id: "subcircuit_b2",
    display_name: "trace_missing_b2",
  },
  // No pcb_trace for this source_trace!

  // ============================================================
  // ERROR 10: PIN MUST BE CONNECTED (checkPinMustBeConnected)
  // Port with must_be_connected=true but not connected to any trace
  // ============================================================
  // Board 1
  {
    type: "source_component",
    source_component_id: "src_must_conn_b1",
    ftype: "simple_resistor",
    name: "R_must_b1",
    resistance: 1000,
    source_group_id: "sg_board1_inner",
  },
  {
    type: "source_port",
    source_port_id: "src_port_must_b1",
    name: "pin1",
    pin_number: 1,
    port_hints: ["1"],
    source_component_id: "src_must_conn_b1",
    subcircuit_id: "subcircuit_b1",
    must_be_connected: true,
  },
  // Board 2
  {
    type: "source_component",
    source_component_id: "src_must_conn_b2",
    ftype: "simple_resistor",
    name: "R_must_b2",
    resistance: 1000,
    source_group_id: "sg_board2_inner",
  },
  {
    type: "source_port",
    source_port_id: "src_port_must_b2",
    name: "pin1",
    pin_number: 1,
    port_hints: ["1"],
    source_component_id: "src_must_conn_b2",
    subcircuit_id: "subcircuit_b2",
    must_be_connected: true,
  },
] as AnyCircuitElement[]

/**
 * Test that verifies DRC checks work correctly on multi-board panels.
 * Each board should have exactly 1 error for each DRC check type.
 * Elements from different boards should NOT cause cross-board errors.
 */
test("panel with 2 boards - each board has exactly 1 of each DRC error (11 checks)", () => {
  // === 1. checkPcbComponentsOutOfBoard: 1 error per board ===
  const componentOutErrors = checkPcbComponentsOutOfBoard(panelCircuitJson)
  expectExactlyOneErrorPerBoard(componentOutErrors, (e) => e.pcb_component_id)

  // === 2. checkViasOffBoard: 1 error per board ===
  const viaOutErrors = checkViasOffBoard(panelCircuitJson)
  expectExactlyOneErrorPerBoard(viaOutErrors, (e) => e.message)

  // === 3. checkPcbTracesOutOfBoard: 1 error per board ===
  const traceEdgeErrors = checkPcbTracesOutOfBoard(panelCircuitJson)
  expectExactlyOneErrorPerBoard(traceEdgeErrors, (e) => e.pcb_trace_id)

  // === 4. checkPcbComponentOverlap: 1 error per board ===
  const overlapErrors = checkPcbComponentOverlap(panelCircuitJson)
  expectExactlyOneErrorPerBoard(overlapErrors, (e) => e.message)

  // === 5. checkEachPcbTraceNonOverlapping: 1 error per board ===
  const traceOverlapErrors = checkEachPcbTraceNonOverlapping(panelCircuitJson)
  expectExactlyOneErrorPerBoard(traceOverlapErrors, (e) => e.pcb_trace_id ?? "")

  // === 6. checkDifferentNetViaSpacing: 1 error per board ===
  const diffViaErrors = checkDifferentNetViaSpacing(panelCircuitJson)
  expectExactlyOneErrorPerBoard(diffViaErrors, (e) => e.pcb_via_ids.join(","))

  // === 7. checkSameNetViaSpacing: 1 error per board ===
  const sameViaErrors = checkSameNetViaSpacing(panelCircuitJson)
  expectExactlyOneErrorPerBoard(sameViaErrors, (e) => e.pcb_via_ids.join(","))

  // === 8. checkEachPcbPortConnectedToPcbTraces: 1 error per board ===
  const portConnErrors = checkEachPcbPortConnectedToPcbTraces(panelCircuitJson)
  expectExactlyOneErrorPerBoard(
    portConnErrors,
    (e) => e.pcb_port_ids?.join(",") ?? "",
  )

  // === 9. checkTracesAreContiguous: at least 1 error per board ===
  // Each disconnected trace has 2 floating endpoints, so more than 2 errors total
  const contiguousErrors = checkTracesAreContiguous(panelCircuitJson)
  const b1ContiguousErrors = contiguousErrors.filter((e) =>
    e.pcb_trace_id?.includes("_b1"),
  )
  const b2ContiguousErrors = contiguousErrors.filter((e) =>
    e.pcb_trace_id?.includes("_b2"),
  )
  expect(b1ContiguousErrors.length).toBeGreaterThanOrEqual(1)
  expect(b2ContiguousErrors.length).toBeGreaterThanOrEqual(1)

  // === 10. checkSourceTracesHavePcbTraces: at least 1 error per board ===
  // Note: This also picks up source traces from error 8 (unconnected ports)
  const missingTraceErrors = checkSourceTracesHavePcbTraces(panelCircuitJson)
  const b1MissingErrors = missingTraceErrors.filter((e) =>
    e.source_trace_id?.includes("_b1"),
  )
  const b2MissingErrors = missingTraceErrors.filter((e) =>
    e.source_trace_id?.includes("_b2"),
  )
  expect(b1MissingErrors.length).toBeGreaterThanOrEqual(1)
  expect(b2MissingErrors.length).toBeGreaterThanOrEqual(1)

  // === 11. checkPinMustBeConnected: 1 error per board ===
  const mustConnectErrors = checkPinMustBeConnected(panelCircuitJson)
  expectExactlyOneErrorPerBoard(mustConnectErrors, (e) => e.source_port_id)
})
