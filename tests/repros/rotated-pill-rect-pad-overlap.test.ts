import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { runAllPlacementChecks } from "../../lib/run-all-checks"

test("rotated pill overlapping a rectangular pad is missed", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "pcb_board_0",
      center: { x: 0.5, y: 0 },
      width: 4,
      height: 4,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "rotated_pill_pad",
      pcb_component_id: "U1",
      shape: "rotated_pill",
      x: 0,
      y: 0,
      width: 0.5599938,
      height: 1.7450054,
      radius: 0.2799969,
      ccw_rotation: 90,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "rect_pad",
      pcb_component_id: "X1",
      shape: "rect",
      x: 1.127514,
      y: 0.445,
      width: 0.8,
      height: 0.9,
      layer: "top",
    },
    {
      type: "pcb_note_text",
      pcb_note_text_id: "issue_note",
      font: "tscircuit2024",
      font_size: 0.25,
      text: "rotated pill overlaps rect pad but placement drc reports no error",
      anchor_position: { x: 0.5, y: -1.4 },
      anchor_alignment: "center",
      layer: "top",
    },
  ]

  const placementIssues = await runAllPlacementChecks(circuitJson)

  expect(placementIssues).toEqual([])
  expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
