import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkSilkscreenClearance } from "lib/check-silkscreen-clearance"
import { runAllChecks, runAllPlacementChecks } from "lib/run-all-checks"

test("clear silkscreen elements pass with no errors", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 50,
      height: 50,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_silkscreen_to_pad_clearance: 0,
    } as any,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "rect",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_silkscreen_text",
      pcb_silkscreen_text_id: "text_clear",
      pcb_component_id: "comp1",
      font: "tscircuit2024",
      anchor_alignment: "center",
      text: "CLEAR",
      font_size: 1,
      anchor_position: { x: 10, y: 10 },
      layer: "top",
    },
    {
      type: "pcb_silkscreen_path",
      pcb_silkscreen_path_id: "path_clear",
      route: [
        { x: 5, y: 5 },
        { x: 8, y: 5 },
      ],
      stroke_width: 0.15,
      layer: "top",
    },
  ]

  const errors = checkSilkscreenClearance(circuitJson)
  expect(errors).toHaveLength(0)
})

test("reproduces issue #5559: detects silkscreen path and text crossing resistor pads", () => {
  // From issue #5559:
  // <resistor name="R1" resistance="1k" footprint="0603" pcbX={0} pcbY={0} />
  // <silkscreenpath route={[{ x: -1.5, y: 0 }, { x: 1.5, y: 0 }]} strokeWidth={0.15} />
  // <silkscreentext text="OVER" pcbX={0.8} pcbY={0} fontSize={0.8} />
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 50,
      height: 50,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_silkscreen_to_pad_clearance: 0,
    } as any,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "r1_pin1",
      shape: "rect",
      x: -0.825,
      y: 0,
      width: 0.8,
      height: 0.9,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "r1_pin2",
      shape: "rect",
      x: 0.825,
      y: 0,
      width: 0.8,
      height: 0.9,
      layer: "top",
    },
    {
      type: "pcb_silkscreen_path",
      pcb_silkscreen_path_id: "path_crossing_pads",
      route: [
        { x: -1.5, y: 0 },
        { x: 1.5, y: 0 },
      ],
      stroke_width: 0.15,
      layer: "top",
    },
    {
      type: "pcb_silkscreen_text",
      pcb_silkscreen_text_id: "text_over_pad",
      pcb_component_id: "comp1",
      font: "tscircuit2024",
      anchor_alignment: "center",
      text: "OVER",
      font_size: 0.8,
      anchor_position: { x: 0.8, y: 0 },
      layer: "top",
    },
  ]

  const errors = checkSilkscreenClearance(circuitJson)
  expect(errors.length).toBeGreaterThanOrEqual(2)
  expect(errors.some((e) => e.message.includes("path_crossing_pads"))).toBe(
    true,
  )
  expect(errors.some((e) => e.message.includes("text_over_pad"))).toBe(true)
})

test("different layer silkscreen and pads do not conflict", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "bottom_pad",
      shape: "rect",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      layer: "bottom",
    },
    {
      type: "pcb_silkscreen_text",
      pcb_silkscreen_text_id: "top_text",
      pcb_component_id: "comp1",
      font: "tscircuit2024",
      anchor_alignment: "center",
      text: "TOP_ONLY",
      font_size: 1,
      anchor_position: { x: 0, y: 0 },
      layer: "top",
    },
  ]

  const errors = checkSilkscreenClearance(circuitJson, { minClearance: 0 })
  expect(errors).toHaveLength(0)
})

test("detects silkscreen line, rect, and circle over vias and plated holes", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_via",
      pcb_via_id: "via1",
      x: 0,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      from_layer: "top",
      to_layer: "bottom",
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_silkscreen_line",
      pcb_silkscreen_line_id: "line_over_via",
      pcb_component_id: "comp1",
      x1: -1,
      y1: 0,
      x2: 1,
      y2: 0,
      stroke_width: 0.15,
      layer: "top",
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "hole1",
      shape: "circle",
      x: 10,
      y: 10,
      hole_diameter: 0.8,
      outer_diameter: 1.4,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_silkscreen_circle",
      pcb_silkscreen_circle_id: "circle_over_hole",
      pcb_component_id: "comp1",
      center: { x: 10, y: 10 },
      radius: 0.5,
      stroke_width: 0.1,
      layer: "top",
    },
  ]

  const errors = checkSilkscreenClearance(circuitJson, { minClearance: 0 })
  expect(errors.length).toBeGreaterThanOrEqual(2)
  expect(errors.some((e) => e.message.includes("line_over_via"))).toBe(true)
  expect(errors.some((e) => e.message.includes("circle_over_hole"))).toBe(true)
})

test("is included in runAllPlacementChecks and runAllChecks when board specifies clearance", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 50,
      height: 50,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_silkscreen_to_pad_clearance: 0,
    } as any,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_target",
      shape: "rect",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_silkscreen_text",
      pcb_silkscreen_text_id: "text_over",
      pcb_component_id: "comp1",
      font: "tscircuit2024",
      anchor_alignment: "center",
      text: "BAD",
      font_size: 1,
      anchor_position: { x: 0, y: 0 },
      layer: "top",
    },
  ]

  const placementErrors = await runAllPlacementChecks(circuitJson)
  expect(placementErrors.some((e) => e.message.includes("text_over"))).toBe(
    true,
  )

  const allErrors = await runAllChecks(circuitJson)
  expect(allErrors.some((e) => e.message.includes("text_over"))).toBe(true)
})
