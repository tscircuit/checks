import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbBoard } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkPadTraceClearance } from "lib/check-pad-trace-clearance"

test("reproduce a trace clearance rule being replaced by the pad clearance", () => {
  const board: PcbBoard = {
    type: "pcb_board", pcb_board_id: "board", center: { x: 0, y: 0 },
    width: 4, height: 2, num_layers: 2, thickness: 1.6,
    min_trace_to_pad_edge_clearance: 0.05,
    min_different_net_trace_edge_to_trace_edge_clearance: 0.1,
  }
  const circuit: AnyCircuitElement[] = [
    board,
    ...[0, 0.175].map((y, index): AnyCircuitElement => ({
      type: "pcb_trace", pcb_trace_id: `trace_${index}`,
      route: [
        { route_type: "wire", x: -1, y, width: 0.1, layer: "top" },
        { route_type: "wire", x: 1, y, width: 0.1, layer: "top" },
      ],
    })),
    {
      type: "pcb_smtpad", pcb_smtpad_id: "foreign_pad", shape: "rect",
      x: 0, y: -0.225, width: 0.2, height: 0.2, layer: "top",
    },
  ]
  const errors = checkEachPcbTraceNonOverlapping(circuit)
  // The two traces have a 0.075 mm edge gap: the requested 0.1 mm rule
  // should report one error. This assertion records the current bug.
  expect(errors).toHaveLength(0)
  expect(checkEachPcbTraceNonOverlapping(circuit, { minClearance: 0.1 })).toHaveLength(1)
  expect(checkPadTraceClearance(circuit)).toHaveLength(0)
  const notes: AnyCircuitElement[] = [
    "Trace / trace: 0.075 mm gap; required 0.1 mm",
    `Reported trace errors: ${errors.length}; expected 1`,
    "Pad / trace: 0.075 mm gap; required 0.05 mm (valid)",
  ].map((text, index) => ({
    type: "pcb_note_text", pcb_note_text_id: `note_${index}`, text,
    anchor_position: { x: 0, y: 0.8 - index * 0.65 },
    anchor_alignment: "center", font: "tscircuit2024", font_size: 0.09,
    layer: "top", color: "#ffffff",
  }))
  expect(convertCircuitJsonToPcbSvg([...circuit, ...notes, ...errors], {
    shouldDrawErrors: true,
  })).toMatchSvgSnapshot(import.meta.path)
})
