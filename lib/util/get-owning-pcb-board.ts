import type { AnyCircuitElement, PcbBoard } from "circuit-json"
import { getBoardOwnerResolver } from "./get-board-owner-resolver"

/**
 * Returns a lookup for the pcb_board whose design rules apply to an element,
 * so panels with boards that declare different minimums are checked against
 * the right one. Elements whose board can't be resolved use the first board.
 */
export function getOwningPcbBoardResolver(circuitJson: AnyCircuitElement[]) {
  const boards = circuitJson.filter(
    (element): element is PcbBoard => element.type === "pcb_board",
  )
  const boardsById = new Map(boards.map((board) => [board.pcb_board_id, board]))
  const getBoardOwner = getBoardOwnerResolver(circuitJson)
  return (element: AnyCircuitElement): PcbBoard | undefined => {
    const boardId = getBoardOwner(element)
    return (boardId ? boardsById.get(boardId) : undefined) ?? boards[0]
  }
}
