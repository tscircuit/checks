import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"

// Exact two-fragment geometry from am3352-dev-board-4layer-dogbone. Removing
// expected ports isolates a second gap: the short stub touches the trunk cap.
// Junction contact must not conceal the exposed copper beyond that junction.
test("reports the AM3352 short ground stub", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_trace",
      source_trace_id: "source_trace_4",
      connected_source_port_ids: [],
      connected_source_net_ids: ["source_net_4"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "fr_source_net_4_288",
      source_trace_id: "source_trace_4",
      route: [
        { route_type: "wire", x: 10.875, y: 1.4, layer: "top", width: 0.1 },
        {
          route_type: "wire",
          x: 10.875,
          y: 1.44999,
          layer: "top",
          width: 0.1,
        },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "fr_source_net_4_349",
      source_trace_id: "source_trace_4",
      route: [
        { route_type: "wire", x: 10.875, y: 1.4, layer: "top", width: 0.1 },
        { route_type: "wire", x: 10.71, y: 0.3, layer: "top", width: 0.1 },
      ],
    },
  ]
  circuitJson.push(
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_ground",
      source_port_id: "source_port_ground",
      x: 10.71,
      y: 0.3,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_ground",
      pcb_port_id: "pcb_port_ground",
      shape: "rect",
      x: 10.71,
      y: 0.3,
      width: 0.2,
      height: 0.2,
      layer: "top",
    },
    {
      type: "pcb_via",
      pcb_via_id: "pcb_via_ground",
      pcb_trace_id: "fr_source_net_4_349",
      x: 10.825,
      y: 1.175,
      outer_diameter: 0.3,
      hole_diameter: 0.15,
      layers: ["top", "inner1", "inner2", "bottom"],
    },
  )
  circuitJson.push(
    ...([
      {
        type: "pcb_board",
        pcb_board_id: "pcb_board_0",
        center: { x: 10.7, y: 1.3 },
        width: 4.6,
        height: 4,
        num_layers: 4,
        thickness: 1.6,
        material: "fr4",
      },
      {
        type: "pcb_note_text",
        font: "tscircuit2024",
        pcb_note_text_id: "pcb_note_text_0",
        text: "AM3352: SHORT GND STUB PAST A VIA",
        anchor_position: { x: 10.7, y: 3 },
        font_size: 0.15,
        color: "white",
        anchor_alignment: "center",
        layer: "top",
      },
      {
        type: "pcb_note_text",
        font: "tscircuit2024",
        pcb_note_text_id: "pcb_note_text_1",
        text: "FIXED: DRC reports the dangling endpoint",
        anchor_position: { x: 10.7, y: 2.65 },
        font_size: 0.14,
        color: "#ff6b6b",
        anchor_alignment: "center",
        layer: "top",
      },
      {
        type: "pcb_note_text",
        font: "tscircuit2024",
        pcb_note_text_id: "pcb_note_text_2",
        text: "0.04999 mm tip overlaps the junction copper cap",
        anchor_position: { x: 10.7, y: 2.28 },
        font_size: 0.135,
        color: "#5994dc",
        anchor_alignment: "center",
        layer: "top",
      },
      {
        type: "pcb_note_text",
        font: "tscircuit2024",
        pcb_note_text_id: "pcb_note_text_3",
        text: "Free tip at (10.875, 1.44999)",
        anchor_position: { x: 10.7, y: 1.92 },
        font_size: 0.13,
        color: "#ff6b6b",
        anchor_alignment: "center",
        layer: "top",
      },
      {
        type: "pcb_note_text",
        font: "tscircuit2024",
        pcb_note_text_id: "pcb_note_text_4",
        text: "GND via",
        anchor_position: { x: 11.75, y: 1.17 },
        font_size: 0.13,
        color: "#5994dc",
        anchor_alignment: "center",
        layer: "top",
      },
      {
        type: "pcb_note_text",
        font: "tscircuit2024",
        pcb_note_text_id: "pcb_note_text_5",
        text: "C_X1 GND pad",
        anchor_position: { x: 10.71, y: 0.05 },
        font_size: 0.13,
        color: "#5994dc",
        anchor_alignment: "center",
        layer: "top",
      },
      {
        type: "pcb_note_text",
        font: "tscircuit2024",
        pcb_note_text_id: "pcb_note_text_6",
        text: "Copper contact at the base does not terminate the tip.",
        anchor_position: { x: 10.7, y: -0.35 },
        font_size: 0.13,
        color: "#5994dc",
        anchor_alignment: "center",
        layer: "top",
      },
    ] satisfies AnyCircuitElement[]),
  )
  const errors = checkTracesAreContiguous(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_trace_error_id).toBe(
    "disconnected_endpoint_fr_source_net_4_288_end",
  )
  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
