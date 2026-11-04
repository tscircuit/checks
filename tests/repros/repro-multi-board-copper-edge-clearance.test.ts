import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { PcbBoard, PcbVia } from "circuit-json"
import { checkCopperToBoardEdgeClearance } from "lib/check-copper-to-board-edge-clearance"

test("repro: a via inside the second board is checked against the first board", () => {
  const left: PcbBoard = {
    type: "pcb_board",
    pcb_board_id: "left",
    subcircuit_id: "left_subcircuit",
    center: { x: -10, y: 0 },
    width: 10,
    height: 10,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
    min_board_edge_clearance: 0.2,
  }
  const right: PcbBoard = {
    ...left,
    pcb_board_id: "right",
    subcircuit_id: "right_subcircuit",
    center: { x: 10, y: 0 },
  }
  const via: PcbVia = {
    type: "pcb_via",
    pcb_via_id: "right_via",
    subcircuit_id: "right_subcircuit",
    x: 10,
    y: 0,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
  }

  // The via has 4.7 mm clearance inside its owning board.
  expect(checkCopperToBoardEdgeClearance([right, via])).toEqual([])

  const circuitJson = [left, right, via]
  const errors = checkCopperToBoardEdgeClearance(circuitJson)
  // Current bug: the unrelated left board makes the same via fail.
  // After the fix, this result should be empty for both board orders.
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_placement_error_id).toBe(
    "copper_too_close_to_board_edge_right_via",
  )
  expect(errors[0].message).toContain("measured 0.000mm")
  expect(checkCopperToBoardEdgeClearance([right, left, via])).toEqual([])

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
