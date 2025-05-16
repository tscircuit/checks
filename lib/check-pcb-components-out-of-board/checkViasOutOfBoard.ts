import type {
  AnyCircuitElement,
  PcbBoard,
  PcbVia,
  PcbPlacementError,
} from "circuit-json"
import { getReadableNameForElement } from "@tscircuit/circuit-json-util"

export function checkViasOutOfBoard(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  const board = circuitJson.find((el) => el.type === "pcb_board") as PcbBoard

  if (!board) return []

  const vias = circuitJson.filter((el) => el.type === "pcb_via") as PcbVia[]

  if (vias.length === 0) return []

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
      viaMinX < boardMinX ||
      viaMaxX > boardMaxX ||
      viaMinY < boardMinY ||
      viaMaxY > boardMaxY
    ) {
      const viaName = getReadableNameForElement(circuitJson, via.pcb_via_id)
      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `out_of_board_${via.pcb_via_id}`,
        message: `Via ${viaName} is outside or crossing the board boundary`,
      })
    }
  }

  return errors
}
