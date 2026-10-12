import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPadPadClearance } from "../../lib/check-pad-pad-clearance"
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

test("via-pad clearance uses its board rule independently of pad-pad clearance", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      thickness: 1.4,
      num_layers: 2,
      material: "fr4",
      min_via_edge_to_pad_edge_clearance: 0.08128,
      min_pad_edge_to_pad_edge_clearance: 0.1,
    },
    {
      type: "pcb_via",
      pcb_via_id: "via",
      x: 0,
      y: 0,
      hole_diameter: 0.1,
      outer_diameter: 0.2,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "via_neighbor_pad",
      shape: "rect",
      x: 0.29,
      y: 0,
      width: 0.2,
      height: 0.2,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_a",
      shape: "rect",
      x: 0,
      y: 2,
      width: 0.2,
      height: 0.2,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_b",
      shape: "rect",
      x: 0.29,
      y: 2,
      width: 0.2,
      height: 0.2,
      layer: "top",
    },
  ]
  const connMap = {
    areIdsConnected: () => false,
  } as any

  expect(checkViaPadClearance(circuitJson, { connMap })).toEqual([])

  const padPadErrors = checkPadPadClearance(circuitJson, { connMap })
  expect(padPadErrors).toHaveLength(1)
  expect(padPadErrors[0].pcb_pad_ids).toEqual(["pad_a", "pad_b"])
  expect(padPadErrors[0].actual_clearance).toBeCloseTo(0.09, 10)
  expect(padPadErrors[0].minimum_clearance).toBe(0.1)
})
