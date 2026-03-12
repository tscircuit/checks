import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbCourtyardOverlap } from "lib/check-pcb-courtyard-overlap/checkPcbCourtyardOverlap"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

// U1 courtyard center (0, 0),   height 2.26 → y: -1.13 to +1.13
// U2 courtyard center (0, 2.1), height 2.26 → y: +0.97 to +3.23
// Courtyard overlap: y = 0.97 → 1.13 (≈ 0.16 mm)
// U1 pad2 top edge: 0.51 + 0.27 = 0.78
// U2 pad1 bottom edge: 2.1 - 0.51 - 0.27 = 1.32
// Pad gap: 0.54 mm → no pad overlap

test("courtyard overlap: vertical (Y-axis only)", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 1 },
      width: 4,
      height: 6,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4" as const,
    },
    {
      type: "source_component",
      source_component_id: "source_U1",
      name: "U1",
      ftype: "simple_chip",
    } as AnyCircuitElement,
    {
      type: "source_component",
      source_component_id: "source_U2",
      name: "U2",
      ftype: "simple_chip",
    } as AnyCircuitElement,
    {
      type: "pcb_component",
      pcb_component_id: "pcb_U1",
      source_component_id: "source_U1",
      layer: "top",
      center: { x: 0, y: 0 },
      width: 1.94,
      height: 2.26,
      rotation: 0,
      obstructs_within_bounds: false,
    } as AnyCircuitElement,
    {
      type: "pcb_component",
      pcb_component_id: "pcb_U2",
      source_component_id: "source_U2",
      layer: "top",
      center: { x: 0, y: 2.1 },
      width: 1.94,
      height: 2.26,
      rotation: 0,
      obstructs_within_bounds: false,
    } as AnyCircuitElement,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_u1_1",
      pcb_component_id: "pcb_U1",
      x: 0,
      y: -0.51,
      width: 0.64,
      height: 0.54,
      layer: "top",
      shape: "rect",
      port_hints: ["1"],
    } as AnyCircuitElement,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_u1_2",
      pcb_component_id: "pcb_U1",
      x: 0,
      y: 0.51,
      width: 0.64,
      height: 0.54,
      layer: "top",
      shape: "rect",
      port_hints: ["2"],
    } as AnyCircuitElement,
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "crtyd_u1",
      pcb_component_id: "pcb_U1",
      center: { x: 0, y: 0 },
      width: 1.94,
      height: 2.26,
      layer: "top",
    } as AnyCircuitElement,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_u2_1",
      pcb_component_id: "pcb_U2",
      x: 0,
      y: 1.59,
      width: 0.64,
      height: 0.54,
      layer: "top",
      shape: "rect",
      port_hints: ["1"],
    } as AnyCircuitElement,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_u2_2",
      pcb_component_id: "pcb_U2",
      x: 0,
      y: 2.61,
      width: 0.64,
      height: 0.54,
      layer: "top",
      shape: "rect",
      port_hints: ["2"],
    } as AnyCircuitElement,
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "crtyd_u2",
      pcb_component_id: "pcb_U2",
      center: { x: 0, y: 2.1 },
      width: 1.94,
      height: 2.26,
      layer: "top",
    } as AnyCircuitElement,
  ]

  const padErrors = checkPcbComponentOverlap(circuitJson)
  expect(padErrors).toHaveLength(0)

  const errors = checkPcbCourtyardOverlap(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].type).toBe("pcb_courtyard_overlap_error")
  expect(errors[0].message).toContain("U1")
  expect(errors[0].message).toContain("U2")

  circuitJson.push(...errors)

  expect(
    convertCircuitJsonToPcbSvg(circuitJson, {
      shouldDrawErrors: true,
      showCourtyards: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
