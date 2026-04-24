import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, PcbPlacementError, PcbVia } from "circuit-json"
import { getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"

export function checkViasOffBoard(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  const board = getPcbBoard(circuitJson)
  if (!board) return []

  const vias = circuitJson.filter((el) => el.type === "pcb_via") as PcbVia[]

  if (vias.length === 0) return []

  if (board.width === undefined || board.height === undefined) return []
  const boardEdgeClearance =
    getBoardDrcValue(board, "min_board_edge_clearance") ??
    jlcMinTolerances.min_board_edge_clearance

  const boardMinX = board.center.x - board.width / 2
  const boardMaxX = board.center.x + board.width / 2
  const boardMinY = board.center.y - board.height / 2
  const boardMaxY = board.center.y + board.height / 2

  const errors: PcbPlacementError[] = []

  for (const via of vias) {
    const viaRadius = via.outer_diameter / 2
    const viaMinX = via.x - viaRadius
    const viaMaxX = via.x + viaRadius
    const viaMinY = via.y - viaRadius
    const viaMaxY = via.y + viaRadius

    if (
      viaMinX < boardMinX + boardEdgeClearance! ||
      viaMaxX > boardMaxX - boardEdgeClearance! ||
      viaMinY < boardMinY + boardEdgeClearance! ||
      viaMaxY > boardMaxY - boardEdgeClearance!
    ) {
      const viaName = getReadableNameForElement(circuitJson, via.pcb_via_id)
      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `out_of_board_${via.pcb_via_id}`,
        message: `Via ${viaName} is outside or crossing the board boundary`,
        error_type: "pcb_placement_error",
      })
    }
  }

  return errors
}
