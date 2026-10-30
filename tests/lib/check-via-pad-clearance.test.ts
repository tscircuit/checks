import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkViaPadClearance } from "../../lib/check-via-pad-clearance"

test("checkViaPadClearance reports an escape via too close to an unrelated fine-pitch pad", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "source_pad",
      shape: "rect",
      x: 0,
      y: 0,
      width: 0.65,
      height: 0.15,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "upper_neighbor_pad",
      shape: "rect",
      x: 0,
      y: 0.35,
      width: 0.65,
      height: 0.15,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "lower_neighbor_pad",
      shape: "rect",
      x: 0,
      y: -0.35,
      width: 0.65,
      height: 0.15,
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "escape_trace",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.15, layer: "top" },
        {
          route_type: "wire",
          x: -0.45,
          y: 0,
          width: 0.15,
          layer: "top",
        },
      ],
    },
    {
      type: "pcb_via",
      pcb_via_id: "escape_via",
      pcb_trace_id: "escape_trace",
      x: -0.45,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      layers: ["top", "inner1"],
    },
  ]

  const errors = checkViaPadClearance(circuitJson, {
    connMap: {
      areIdsConnected: (a: string, b: string) =>
        [a, b].includes("escape_via") && [a, b].includes("source_pad"),
    } as any,
  })

  const svg = convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
    shouldDrawErrors: true,
    showErrorsInTextOverlay: true,
  })

  expect(errors).toHaveLength(2)
  expect(errors.map((error) => error.pcb_pad_ids)).toEqual([
    ["escape_via", "lower_neighbor_pad"],
    ["escape_via", "upper_neighbor_pad"],
  ])
  expect(errors.every((error) => error.minimum_clearance === 0.1)).toBe(true)
  expect(
    errors.every(
      (error) =>
        error.actual_clearance !== undefined &&
        Math.abs(error.actual_clearance - 0.002076) < 1e-5,
    ),
  ).toBe(true)

  expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test("checkViaPadClearance prioritizes min_via_edge_to_pad_edge_clearance over min_pad_edge_to_pad_edge_clearance", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 20,
      height: 10,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_via_edge_to_pad_edge_clearance: 0.2,
      min_pad_edge_to_pad_edge_clearance: 0.1,
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "rect",
      x: 0.825,
      y: 0,
      width: 0.85,
      height: 0.9,
      layer: "top",
    },
    {
      type: "pcb_via",
      pcb_via_id: "via1",
      x: 1.675,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      layers: ["top", "bottom"],
    },
  ]

  // Pad right edge: 0.825 + 0.85/2 = 1.25mm
  // Via left edge: 1.675 - 0.6/2 = 1.375mm
  // Clearance gap: 1.375 - 1.25 = 0.125mm
  // 0.125mm is > min_pad_edge_to_pad_edge_clearance (0.1mm),
  // but < min_via_edge_to_pad_edge_clearance (0.2mm).
  // Therefore, checkViaPadClearance must report an error with minimum: 0.2mm.
  const errors = checkViaPadClearance(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].minimum_clearance).toBe(0.2)
  expect(errors[0].message).toContain("minimum: 0.2mm")
})
