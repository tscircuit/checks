import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbCourtyardOverlap } from "lib/check-pcb-courtyard-overlap/checkPcbCourtyardOverlap"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

// U1 is the central component.
// U2 overlaps U1's top-right corner (diagonal from top-right).
// U3 overlaps U1's bottom-right corner (diagonal from bottom-right).
//
// U1 courtyard center (0, 0), 2.26×1.94 → x: -1.13 to +1.13, y: -0.97 to +0.97
//
// U2 center (2.0,  1.7) → courtyard x: +0.87→+3.13, y: +0.73→+2.67
//   overlap: x 0.87→1.13 (0.26mm), y 0.73→0.97 (0.24mm)
//
// U3 center (2.0, -1.7) → courtyard x: +0.87→+3.13, y: -2.67→-0.73
//   overlap: x 0.87→1.13 (0.26mm), y -0.97→-0.73 (0.24mm)
//
// U2 and U3 do not overlap each other → 2 courtyard errors, 0 pad errors

test("courtyard overlap: top-right and bottom-right corner overlaps", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 1, y: 0 },
      width: 8,
      height: 7,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4" as const,
    },
    ...(["U1", "U2", "U3"].map((name) => ({
      type: "source_component" as const,
      source_component_id: `source_${name}`,
      name,
      ftype: "simple_chip" as const,
    })) as AnyCircuitElement[]),
    {
      type: "pcb_component",
      pcb_component_id: "pcb_U1",
      source_component_id: "source_U1",
      layer: "top",
      center: { x: 0, y: 0 },
      width: 2.26,
      height: 1.94,
      rotation: 0,
      obstructs_within_bounds: false,
    } as AnyCircuitElement,
    {
      type: "pcb_component",
      pcb_component_id: "pcb_U2",
      source_component_id: "source_U2",
      layer: "top",
      center: { x: 2.0, y: 1.7 },
      width: 2.26,
      height: 1.94,
      rotation: 0,
      obstructs_within_bounds: false,
    } as AnyCircuitElement,
    {
      type: "pcb_component",
      pcb_component_id: "pcb_U3",
      source_component_id: "source_U3",
      layer: "top",
      center: { x: 2.0, y: -1.7 },
      width: 2.26,
      height: 1.94,
      rotation: 0,
      obstructs_within_bounds: false,
    } as AnyCircuitElement,
    // Pads — U1
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_u1_1",
      pcb_component_id: "pcb_U1",
      x: -0.51,
      y: 0,
      width: 0.54,
      height: 0.64,
      layer: "top",
      shape: "rect",
      port_hints: ["1"],
    } as AnyCircuitElement,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_u1_2",
      pcb_component_id: "pcb_U1",
      x: 0.51,
      y: 0,
      width: 0.54,
      height: 0.64,
      layer: "top",
      shape: "rect",
      port_hints: ["2"],
    } as AnyCircuitElement,
    // Pads — U2
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_u2_1",
      pcb_component_id: "pcb_U2",
      x: 1.49,
      y: 1.7,
      width: 0.54,
      height: 0.64,
      layer: "top",
      shape: "rect",
      port_hints: ["1"],
    } as AnyCircuitElement,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_u2_2",
      pcb_component_id: "pcb_U2",
      x: 2.51,
      y: 1.7,
      width: 0.54,
      height: 0.64,
      layer: "top",
      shape: "rect",
      port_hints: ["2"],
    } as AnyCircuitElement,
    // Pads — U3
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_u3_1",
      pcb_component_id: "pcb_U3",
      x: 1.49,
      y: -1.7,
      width: 0.54,
      height: 0.64,
      layer: "top",
      shape: "rect",
      port_hints: ["1"],
    } as AnyCircuitElement,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_u3_2",
      pcb_component_id: "pcb_U3",
      x: 2.51,
      y: -1.7,
      width: 0.54,
      height: 0.64,
      layer: "top",
      shape: "rect",
      port_hints: ["2"],
    } as AnyCircuitElement,
    // Courtyards
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "crtyd_u1",
      pcb_component_id: "pcb_U1",
      center: { x: 0, y: 0 },
      width: 2.26,
      height: 1.94,
      layer: "top",
    } as AnyCircuitElement,
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "crtyd_u2",
      pcb_component_id: "pcb_U2",
      center: { x: 2.0, y: 1.7 },
      width: 2.26,
      height: 1.94,
      layer: "top",
    } as AnyCircuitElement,
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "crtyd_u3",
      pcb_component_id: "pcb_U3",
      center: { x: 2.0, y: -1.7 },
      width: 2.26,
      height: 1.94,
      layer: "top",
    } as AnyCircuitElement,
  ]

  const padErrors = checkPcbComponentOverlap(circuitJson)
  expect(padErrors).toHaveLength(0)

  const errors = checkPcbCourtyardOverlap(circuitJson)
  expect(errors).toHaveLength(2)

  const pairs = errors.map((e) => e.pcb_component_ids.slice().sort().join("↔"))
  expect(pairs).toContain("pcb_U1↔pcb_U2")
  expect(pairs).toContain("pcb_U1↔pcb_U3")

  circuitJson.push(...errors)

  expect(
    convertCircuitJsonToPcbSvg(circuitJson, {
      shouldDrawErrors: true,
      showCourtyards: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
