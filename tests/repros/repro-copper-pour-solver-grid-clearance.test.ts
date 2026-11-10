import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbCopperPour } from "circuit-json"
import { checkCopperToBoardEdgeClearance } from "lib/check-copper-to-board-edge-clearance"

const board: AnyCircuitElement = {
  type: "pcb_board",
  pcb_board_id: "board",
  center: { x: 0, y: 0 },
  width: 10,
  height: 10,
  num_layers: 2,
  thickness: 1.6,
  material: "fr4",
  min_board_edge_clearance: 0.2,
}

const SOLVER_GRID_SHORTFALL_MM = 1.078e-6
const roundedPourEdgeX = 4.8 + SOLVER_GRID_SHORTFALL_MM

const solverGridRoundedPour: PcbCopperPour = {
  type: "pcb_copper_pour",
  pcb_copper_pour_id: "solver_grid_rounded_pour",
  shape: "brep",
  brep_shape: {
    outer_ring: {
      vertices: [
        { x: -4.8, y: -4.8 },
        { x: roundedPourEdgeX, y: -4.8 },
        { x: roundedPourEdgeX, y: 4.8 },
        { x: -4.8, y: 4.8 },
      ],
    },
    inner_rings: [],
  },
  layer: "top",
  covered_with_solder_mask: true,
}

test("a copper pour rounded by the solver grid does not violate board-edge clearance", () => {
  expect(
    checkCopperToBoardEdgeClearance([board, solverGridRoundedPour]),
  ).toEqual([])
})
