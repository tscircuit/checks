import type {
  AnyCircuitElement,
  PcbBoard,
  SourceBoard,
  SourceGroup,
} from "circuit-json"
import type { ElementWithSubcircuitId } from "./areElementsOnSameBoard"

/**
 * Find the pcb_board that an element belongs to based on subcircuit_id relationships.
 *
 * The mapping chain is:
 * - element.subcircuit_id -> source_group.subcircuit_id
 * - source_group.source_group_id <- source_board.source_group_id
 * - source_board.source_board_id <- pcb_board.source_board_id
 */
export function findBoardForElement(
  circuitJson: AnyCircuitElement[],
  element: ElementWithSubcircuitId,
): PcbBoard | null {
  // If element doesn't have subcircuit_id, we can't determine its board
  const subcircuitId = element.subcircuit_id
  if (!subcircuitId) return null

  // Find the source_group that has this subcircuit_id
  const sourceGroup = circuitJson.find(
    (el): el is SourceGroup =>
      el.type === "source_group" && el.subcircuit_id === subcircuitId,
  )
  if (!sourceGroup) return null

  // Find the source_board that has this source_group_id
  const sourceBoard = circuitJson.find(
    (el): el is SourceBoard =>
      el.type === "source_board" &&
      el.source_group_id === sourceGroup.source_group_id,
  )
  if (!sourceBoard) return null

  // Find the pcb_board that has this source_board_id
  // Note: source_board_id may not be in circuit-json types yet, so we cast
  const pcbBoard = circuitJson.find(
    (el): el is PcbBoard =>
      el.type === "pcb_board" &&
      (el as any).source_board_id === sourceBoard.source_board_id,
  )

  return pcbBoard || null
}
