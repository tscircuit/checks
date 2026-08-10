import {
  getPrimaryId,
  getReadableNameForElement,
} from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, PcbPlacementError } from "circuit-json"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import { getPadBounds, getPads } from "lib/check-pad-clearance/common"
import { getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"

/**
 * Flag SMT pads and plated holes whose copper is closer to the board edge than
 * the minimum board-edge clearance (or hangs off the board entirely).
 *
 * Traces (checkPcbTracesOutOfBoard) and vias (checkViasOffBoard) already enforce
 * min_board_edge_clearance, but pad copper was never checked. A pad sitting in the
 * clearance band is easy to miss: the component it belongs to can be fully inside
 * the board, so checkPcbComponentsOutOfBoard stays silent while the copper is still
 * too close to the routed/scored edge.
 */
export function checkPadsOffBoard(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  const board = getPcbBoard(circuitJson)
  if (!board) return []

  const pads = getPads(circuitJson)
  if (pads.length === 0) return []

  if (board.width === undefined || board.height === undefined) return []
  const boardEdgeClearance =
    getBoardDrcValue(board, "min_board_edge_clearance") ??
    jlcMinTolerances.min_board_edge_clearance

  const boardMinX = board.center.x - board.width / 2
  const boardMaxX = board.center.x + board.width / 2
  const boardMinY = board.center.y - board.height / 2
  const boardMaxY = board.center.y + board.height / 2

  const errors: PcbPlacementError[] = []

  for (const pad of pads) {
    const bounds = getPadBounds(pad)

    if (
      bounds.minX < boardMinX + boardEdgeClearance! ||
      bounds.maxX > boardMaxX - boardEdgeClearance! ||
      bounds.minY < boardMinY + boardEdgeClearance! ||
      bounds.maxY > boardMaxY - boardEdgeClearance!
    ) {
      const padId = getPrimaryId(pad)
      const padName = getReadableNameForElement(circuitJson, padId)
      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `pad_off_board_${padId}`,
        message: `Pad ${padName} is too close to or crossing the board edge (minimum clearance: ${boardEdgeClearance}mm)`,
        error_type: "pcb_placement_error",
      })
    }
  }

  return errors
}
