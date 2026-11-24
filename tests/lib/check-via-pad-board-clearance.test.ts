import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbBoard } from "circuit-json"
import { checkViaPadClearance } from "../../lib/check-via-pad-clearance"

test("via-pad clearance prioritizes the via rule and preserves overrides and fallback", () => {
  const board: PcbBoard = {
    type: "pcb_board",
    pcb_board_id: "board",
    center: { x: 0, y: 0 },
    width: 20,
    height: 10,
    num_layers: 2,
    thickness: 1.6,
    material: "fr4",
    min_via_edge_to_pad_edge_clearance: 0.2,
    min_pad_edge_to_pad_edge_clearance: 0.1,
  }
  const copper: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad",
      shape: "rect",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_via",
      pcb_via_id: "via",
      x: 0.95,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      layers: ["top", "bottom"],
    },
  ]
  const json = [board, ...copper]
  const errors = checkViaPadClearance(json)
  expect(errors).toHaveLength(1)
  expect(errors[0].actual_clearance).toBeCloseTo(0.15)
  expect(errors[0].minimum_clearance).toBe(0.2)
  expect(checkViaPadClearance(json, { minClearance: 0.1 })).toHaveLength(0)
  expect(checkViaPadClearance(json, { minClearance: 0 })).toHaveLength(0)
  expect(
    checkViaPadClearance([
      { ...board, min_via_edge_to_pad_edge_clearance: undefined },
      ...copper,
    ]),
  ).toHaveLength(0)
  expect(
    checkViaPadClearance([
      {
        ...board,
        min_via_edge_to_pad_edge_clearance: undefined,
        min_pad_edge_to_pad_edge_clearance: 0.25,
      },
      ...copper,
    ])[0].minimum_clearance,
  ).toBe(0.25)
  expect(
    checkViaPadClearance([
      { ...board, min_via_edge_to_pad_edge_clearance: 0.15 },
      ...copper,
    ]),
  ).toHaveLength(0)
})
