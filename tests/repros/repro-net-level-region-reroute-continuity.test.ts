import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

const ROOT_SOURCE_TRACE_ID = "source_trace_arduino_net"

// A regional reroute replaces only the copper inside a repair window. The
// replacement remains physically connected to the retained copper at both
// boundary points, while all three pcb_trace records retain the same logical
// source trace identity. The replacement endpoints are offset by 0.0003 mm to
// reproduce the harmless coordinate rounding seen in the Arduino reroute.
const circuitJson = [
  {
    type: "source_trace",
    source_trace_id: ROOT_SOURCE_TRACE_ID,
    connected_source_port_ids: [],
    connected_source_net_ids: [],
  },
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_region_reroute",
    center: { x: 0, y: 0 },
    width: 12,
    height: 5,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_left",
    pcb_port_id: "pcb_port_left",
    shape: "rect",
    x: -5,
    y: 0,
    width: 1,
    height: 1,
    layer: "top",
  },
  {
    type: "pcb_note_text",
    pcb_note_text_id: "pcb_note_text_region_reroute",
    text: "replacement inside repair region",
    anchor_position: { x: 0, y: 1.8 },
    anchor_alignment: "center",
    font: "tscircuit2024",
    font_size: 0.28,
    layer: "top",
    color: "#fbbf24",
  },
  {
    type: "pcb_note_text",
    pcb_note_text_id: "pcb_note_text_left_join",
    text: "physical join",
    anchor_position: { x: -2, y: -0.8 },
    anchor_alignment: "center",
    font: "tscircuit2024",
    font_size: 0.25,
    layer: "top",
    color: "#fbbf24",
  },
  {
    type: "pcb_note_text",
    pcb_note_text_id: "pcb_note_text_right_join",
    text: "physical join",
    anchor_position: { x: 2, y: -0.8 },
    anchor_alignment: "center",
    font: "tscircuit2024",
    font_size: 0.25,
    layer: "top",
    color: "#fbbf24",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_right",
    pcb_port_id: "pcb_port_right",
    shape: "rect",
    x: 5,
    y: 0,
    width: 1,
    height: 1,
    layer: "top",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_keep_before_region",
    source_trace_id: ROOT_SOURCE_TRACE_ID,
    route: [
      { route_type: "wire", x: -5, y: 0, width: 0.3, layer: "top" },
      { route_type: "wire", x: -2, y: 0, width: 0.3, layer: "top" },
    ],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_reroute_inside_region",
    source_trace_id: ROOT_SOURCE_TRACE_ID,
    route: [
      { route_type: "wire", x: -1.9997, y: 0, width: 0.3, layer: "top" },
      { route_type: "wire", x: 0, y: 1, width: 0.3, layer: "top" },
      { route_type: "wire", x: 1.9997, y: 0, width: 0.3, layer: "top" },
    ],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_keep_after_region",
    source_trace_id: ROOT_SOURCE_TRACE_ID,
    route: [
      { route_type: "wire", x: 2, y: 0, width: 0.3, layer: "top" },
      { route_type: "wire", x: 5, y: 0, width: 0.3, layer: "top" },
    ],
  },
] satisfies AnyCircuitElement[]

test("reproduces false disconnected endpoints at net-level region-reroute joins", () => {
  const errors = checkTracesAreContiguous(circuitJson)

  expect(errors).toEqual([])

  expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
