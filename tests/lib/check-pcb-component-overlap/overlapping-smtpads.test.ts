import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test("overlapping SMT pads from different nets should show error", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 20,
      height: 20,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4" as const,
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "rect",
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad2",
      shape: "rect",
      x: 1,
      y: 1,
      width: 2,
      height: 2,
      layer: "top",
    },
  ]

  const errors = checkPcbComponentOverlap(soup)

  // Verify error is detected
  expect(errors.length).toBe(1)
  expect(errors[0].type).toBe("pcb_footprint_overlap_error")
  expect(errors[0].pcb_smtpad_ids).toEqual(["pad1", "pad2"])

  // Add errors to circuit JSON for shouldDrawErrors visualization
  soup.push(...errors)

  // Add visual error indicator below the overlapping pads for visibility
  soup.push({
    type: "pcb_silkscreen_text",
    pcb_silkscreen_text_id: "error_indicator_1",
    pcb_component_id: "",
    anchor_position: { x: 0.5, y: -1.5 },
    anchor_alignment: "center",
    font: "tscircuit2024",
    font_size: 0.7,
    layer: "top",
    text: "⚠ SMT PAD OVERLAP",
  })

  // Create visual snapshot with error indicators (both shouldDrawErrors and silkscreen)
  expect(
    convertCircuitJsonToPcbSvg(soup, { shouldDrawErrors: true }),
  ).toMatchSvgSnapshot(import.meta.path)
})
