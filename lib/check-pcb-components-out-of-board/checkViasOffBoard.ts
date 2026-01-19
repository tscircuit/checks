import type {
  AnyCircuitElement,
  PcbBoard,
  PcbVia,
  PcbPlacementError,
} from "circuit-json"
import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import { DEFAULT_VIA_BOARD_MARGIN } from "lib/drc-defaults"
import { findBoardForElement } from "lib/util/findBoardForElement"
import Flatten from "@flatten-js/core"
import { boardToPolygon } from "lib/util/boardToPolygon"

/**
 * Check if a via is inside the board polygon with the required margin.
 * Returns the distance outside the board if the via is outside, or null if inside.
 */
function getViaDistanceOutsideBoard(
  via: PcbVia,
  boardPoly: Flatten.Polygon,
  margin: number,
): number | null {
  const viaCenter = new Flatten.Point(via.x, via.y)
  const viaRadius = via.outer_diameter / 2

  // Check if via center is inside the board
  if (!boardPoly.contains(viaCenter)) {
    const dist = boardPoly.distanceTo(viaCenter)
    return Array.isArray(dist) ? dist[0] : Number(dist) || 0
  }

  // Check distance from via center to board edge
  const distToEdge = boardPoly.distanceTo(viaCenter)
  const distanceToEdge = Array.isArray(distToEdge)
    ? distToEdge[0]
    : Number(distToEdge) || 0

  // Via needs to be at least (viaRadius + margin) away from the edge
  const requiredDistance = viaRadius + margin
  if (distanceToEdge < requiredDistance) {
    return requiredDistance - distanceToEdge
  }

  return null
}

export function checkViasOffBoard(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  const boards = circuitJson.filter(
    (el): el is PcbBoard => el.type === "pcb_board",
  )
  if (boards.length === 0) return []

  const vias = circuitJson.filter((el): el is PcbVia => el.type === "pcb_via")
  if (vias.length === 0) return []

  // Build a map from board id to its polygon
  const boardPolygonMap = new Map<string, Flatten.Polygon>()
  for (const board of boards) {
    const poly = boardToPolygon(board)
    if (poly) {
      boardPolygonMap.set(board.pcb_board_id, poly)
    }
  }

  const singleBoard = boards.length === 1 ? boards[0] : null
  const singleBoardPoly = singleBoard
    ? boardPolygonMap.get(singleBoard.pcb_board_id)
    : null

  const errors: PcbPlacementError[] = []

  for (const via of vias) {
    // Find the board this via belongs to
    let board: PcbBoard | null = null
    let boardPoly: Flatten.Polygon | null | undefined = null

    if (singleBoard && singleBoardPoly) {
      // Single board case - use it for all vias
      board = singleBoard
      boardPoly = singleBoardPoly
    } else {
      // Multiple boards - find the via's specific board
      board = findBoardForElement(circuitJson, via)
      if (board) {
        boardPoly = boardPolygonMap.get(board.pcb_board_id)
      }
    }

    // If we can't find a board for this via, skip it
    if (!board || !boardPoly) continue

    const distanceOutside = getViaDistanceOutsideBoard(
      via,
      boardPoly,
      DEFAULT_VIA_BOARD_MARGIN,
    )

    if (distanceOutside !== null) {
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
