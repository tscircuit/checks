import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test("mixed component types overlapping should show multiple errors", () => {
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
    // SMT pad overlapping with plated hole
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
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "hole1",
      shape: "circle",
      x: 0.8,
      y: 0,
      outer_diameter: 1.5,
      hole_diameter: 0.8,
      layers: ["top", "bottom"],
    },
    // PCB hole overlapping with SMT pad
    {
      type: "pcb_hole",
      pcb_hole_id: "hole2",
      hole_shape: "circle",
      x: -1,
      y: 0,
      hole_diameter: 1.5,
    },
  ]

  const errors = checkPcbComponentOverlap(soup)

  // Should detect multiple overlaps
  expect(errors.length).toBeGreaterThanOrEqual(2)
  expect(errors.some((e) => e.pcb_smtpad_ids?.includes("pad1"))).toBe(true)
  expect(errors.some((e) => e.pcb_plated_hole_ids?.includes("hole1"))).toBe(
    true,
  )
  expect(errors.some((e) => e.pcb_hole_ids?.includes("hole2"))).toBe(true)

  // Add visual error indicators for each overlap
  // Position indicators below the overlapping components with spacing to avoid overlap
  if (errors.length > 0) {
    soup.push({
      type: "pcb_silkscreen_text",
      pcb_silkscreen_text_id: "error_indicator_1",
      pcb_component_id: "",
      anchor_position: { x: 0.8, y: -2 },
      anchor_alignment: "center",
      font: "tscircuit2024",
      font_size: 0.5,
      layer: "top",
      text: "⚠ pad+hole",
    })
    soup.push({
      type: "pcb_silkscreen_text",
      pcb_silkscreen_text_id: "error_indicator_2",
      pcb_component_id: "",
      anchor_position: { x: -1, y: -2.5 },
      anchor_alignment: "center",
      font: "tscircuit2024",
      font_size: 0.5,
      layer: "top",
      text: "⚠ hole+pad",
    })
  }

  // Create visual snapshot with error indicators
  expect(convertCircuitJsonToPcbSvg(soup)).toMatchSvgSnapshot(import.meta.path)
})
