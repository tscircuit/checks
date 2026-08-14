import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

const circuitJson: AnyCircuitElement[] = [
  {
    type: "pcb_board",
    pcb_board_id: "board",
    center: { x: 0, y: 0 },
    width: 10,
    height: 8,
    num_layers: 2,
    thickness: 1.6,
    material: "fr4",
  },
  {
    type: "source_net",
    source_net_id: "source_net_ground",
    name: "GND",
    member_source_group_ids: [],
    is_ground: true,
  },
  {
    type: "source_net",
    source_net_id: "source_net_signal",
    name: "SIGNAL",
    member_source_group_ids: [],
  },
  {
    type: "source_trace",
    source_trace_id: "source_trace_signal",
    connected_source_port_ids: [],
    connected_source_net_ids: ["source_net_signal"],
  },
  {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "ground_pour",
    source_net_id: "source_net_ground",
    shape: "brep",
    brep_shape: {
      outer_ring: {
        vertices: [
          { x: -2, y: -1.5 },
          { x: 2, y: -1.5 },
          { x: 2, y: 1.5 },
          { x: -2, y: 1.5 },
        ],
      },
      inner_rings: [],
    },
    layer: "top",
    covered_with_solder_mask: true,
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "signal_trace",
    source_trace_id: "source_trace_signal",
    route: [
      { route_type: "wire", x: -4, y: 0, width: 0.25, layer: "top" },
      { route_type: "wire", x: 4, y: 0, width: 0.25, layer: "top" },
    ],
  },
  {
    type: "pcb_note_text",
    pcb_note_text_id: "expected_note",
    font: "tscircuit2024",
    font_size: 0.28,
    text: "EXPECTED: DRC reports SIGNAL crossing GND pour",
    anchor_position: { x: 0, y: 2.7 },
    anchor_alignment: "center",
    layer: "top",
    color: "blue",
  },
  {
    type: "pcb_note_text",
    pcb_note_text_id: "actual_note",
    font: "tscircuit2024",
    font_size: 0.28,
    text: "FIXED: copper-pour contact error reported",
    anchor_position: { x: 0, y: -2.7 },
    anchor_alignment: "center",
    layer: "top",
    color: "green",
  },
]

test("different-net trace contact with a BREP copper pour is reported", () => {
  const traceErrors = checkEachPcbTraceNonOverlapping(circuitJson)
  const copperPourContactErrors = traceErrors.filter((error) =>
    error.message.includes("ground_pour"),
  )

  expect(copperPourContactErrors).toHaveLength(1)
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...traceErrors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
