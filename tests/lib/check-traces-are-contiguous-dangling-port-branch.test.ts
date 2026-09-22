import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"

const wire = (x: number, y: number): PcbTrace["route"][number] => ({
  route_type: "wire",
  x,
  y,
  layer: "top",
  width: 0.2,
})

// Known false negative: checking the required ports must not skip later branches.
test("reproduces missed DRC on a source-associated dangling branch", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_trace",
      source_trace_id: "source_trace_1",
      connected_source_port_ids: ["source_port_1", "source_port_2"],
      connected_source_net_ids: [],
    },
    ...[0, 2].flatMap((x, i): AnyCircuitElement[] => [
      {
        type: "pcb_port",
        pcb_port_id: `pcb_port_${i + 1}`,
        source_port_id: `source_port_${i + 1}`,
        x,
        y: 0,
        layers: ["top"],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: `pcb_smtpad_${i + 1}`,
        pcb_port_id: `pcb_port_${i + 1}`,
        shape: "rect",
        x,
        y: 0,
        width: 0.4,
        height: 0.4,
        layer: "top",
      },
    ]),
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_main",
      source_trace_id: "source_trace_1",
      route: [wire(0, 0), wire(2, 0)],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_branch",
      source_trace_id: "source_trace_1",
      route: [wire(1, 0), wire(1, 2)],
    },
  ]
  circuitJson.push(
    ...([
      {
        type: "pcb_board",
        pcb_board_id: "pcb_board_0",
        center: { x: 1, y: 1 },
        width: 7,
        height: 5,
        num_layers: 4,
        thickness: 1.6,
        material: "fr4",
      },
      {
        type: "pcb_note_text",
        pcb_note_text_id: "pcb_note_text_0",
        text: "DANGLING BRANCH: SOURCE-ASSOCIATED TRACE",
        anchor_position: { x: 1, y: 3.1 },
        font_size: 0.21,
        color: "white",
        anchor_alignment: "center",
        layer: "top",
      },
      {
        type: "pcb_note_text",
        pcb_note_text_id: "pcb_note_text_1",
        text: "BROKEN: DRC reports 0 errors; expected 1",
        anchor_position: { x: 1, y: 2.6 },
        font_size: 0.19,
        color: "#ff6b6b",
        anchor_alignment: "center",
        layer: "top",
      },
      {
        type: "pcb_note_text",
        pcb_note_text_id: "pcb_note_text_2",
        text: "Free endpoint",
        anchor_position: { x: 1, y: 2.22 },
        font_size: 0.17,
        color: "#ff6b6b",
        anchor_alignment: "center",
        layer: "top",
      },
      {
        type: "pcb_note_text",
        pcb_note_text_id: "pcb_note_text_3",
        text: "TX pad",
        anchor_position: { x: 0, y: -0.42 },
        font_size: 0.18,
        color: "#5994dc",
        anchor_alignment: "center",
        layer: "top",
      },
      {
        type: "pcb_note_text",
        pcb_note_text_id: "pcb_note_text_4",
        text: "RX pad",
        anchor_position: { x: 2, y: -0.42 },
        font_size: 0.18,
        color: "#5994dc",
        anchor_alignment: "center",
        layer: "top",
      },
      {
        type: "pcb_note_text",
        pcb_note_text_id: "pcb_note_text_5",
        text: "Both pads connect, but the extra branch is open.",
        anchor_position: { x: 1, y: -0.9 },
        font_size: 0.19,
        color: "#5994dc",
        anchor_alignment: "center",
        layer: "top",
      },
    ] satisfies AnyCircuitElement[]),
  )
  const errors = checkTracesAreContiguous(circuitJson)
  // This first PR records the broken baseline; the fix must change this to 1.
  expect(errors).toHaveLength(0)
  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
