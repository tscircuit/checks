import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test("overlapping plated holes should show error", () => {
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
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "hole1",
      shape: "circle",
      x: 0,
      y: 0,
      outer_diameter: 2,
      hole_diameter: 1,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "hole2",
      shape: "circle",
      x: 1.5,
      y: 0,
      outer_diameter: 2,
      hole_diameter: 1,
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkPcbComponentOverlap(soup)

  // Verify error is detected
  expect(errors.length).toBe(1)
  expect(errors[0].type).toBe("pcb_footprint_overlap_error")
  expect(errors[0].pcb_plated_hole_ids).toEqual(["hole1", "hole2"])

  // Add visual error indicator above the overlapping holes for visibility
  if (errors.length > 0) {
    soup.push({
      type: "pcb_silkscreen_text",
      pcb_silkscreen_text_id: "error_indicator_1",
      pcb_component_id: "",
      anchor_position: { x: 0.75, y: -1.5 },
      anchor_alignment: "center",
      font: "tscircuit2024",
      font_size: 0.7,
      layer: "top",
      text: "⚠ HOLE OVERLAP",
    })
  }

  // Create visual snapshot with error indicators
  expect(convertCircuitJsonToPcbSvg(soup)).toMatchSvgSnapshot(import.meta.path)
})
