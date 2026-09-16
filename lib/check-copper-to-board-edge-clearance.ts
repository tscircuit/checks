import * as Flatten from "@flatten-js/core"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbComponent,
  PcbPlacementError,
} from "circuit-json"
import { getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import {
  getCopperGeometry,
  pointsToPolygon,
  type CopperElement,
  type CopperGeometry,
} from "./util/copper-geometry"

const GEOMETRY_EPSILON = 1e-9

const boardToPolygon = (board: PcbBoard): Flatten.Polygon | null => {
  if (board.outline && board.outline.length >= 3) {
    return pointsToPolygon(board.outline)
  }

  if (
    !board.center ||
    typeof board.width !== "number" ||
    typeof board.height !== "number"
  ) {
    return null
  }

  const halfWidth = board.width / 2
  const halfHeight = board.height / 2
  return pointsToPolygon([
    { x: board.center.x - halfWidth, y: board.center.y - halfHeight },
    { x: board.center.x + halfWidth, y: board.center.y - halfHeight },
    { x: board.center.x + halfWidth, y: board.center.y + halfHeight },
    { x: board.center.x - halfWidth, y: board.center.y + halfHeight },
  ])
}

const getCopperElementId = (element: CopperElement): string => {
  if (element.type === "pcb_via") return element.pcb_via_id
  if (element.type === "pcb_smtpad") return element.pcb_smtpad_id
  if (element.type === "pcb_plated_hole") return element.pcb_plated_hole_id
  return element.pcb_copper_pour_id
}

const getCopperElementLabel = (element: CopperElement): string => {
  if (element.type === "pcb_via") return "Via"
  if (element.type === "pcb_smtpad") return "SMT pad"
  if (element.type === "pcb_plated_hole") return "Plated hole"
  return "Copper pour"
}

const measureClearance = (
  board: Flatten.Polygon,
  geometry: CopperGeometry,
): { isInside: boolean; clearance: number } => {
  if (geometry.kind === "shapes") {
    const isInside = geometry.shapes.every((shape) => board.contains(shape))
    return {
      isInside,
      clearance: isInside
        ? Math.min(
            ...geometry.shapes.map((shape) => board.distanceTo(shape)[0]),
          )
        : 0,
    }
  }

  const centerLineClearance = board.distanceTo(geometry.centerLine)[0]
  const clearance = centerLineClearance - geometry.radius
  const isInside =
    board.contains(geometry.centerLine) && clearance >= -GEOMETRY_EPSILON
  return {
    isInside,
    clearance: isInside ? Math.max(0, clearance) : 0,
  }
}

/**
 * Checks the finished copper geometry of every via, SMT pad, plated hole, and
 * copper pour against the real board outline and its configured edge-clearance
 * rule.
 *
 * Component and footprint rotations are normally composed into Circuit JSON's
 * absolute coordinates and `ccw_rotation` fields. Polygon-pad plated holes are
 * the exception: their outline stays local, so it is translated and rotated by
 * the owning component here.
 */
export function checkCopperToBoardEdgeClearance(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  const board = getPcbBoard(circuitJson)
  if (!board) return []

  const boardPolygon = boardToPolygon(board)
  if (!boardPolygon) return []

  const requiredClearance =
    getBoardDrcValue(board, "min_board_edge_clearance") ??
    jlcMinTolerances.min_board_edge_clearance
  if (requiredClearance === undefined) return []

  const allowedOffBoardComponentIds = new Set<string>(
    circuitJson
      .filter(
        (element): element is PcbComponent => element.type === "pcb_component",
      )
      .filter((component) => component.is_allowed_to_be_off_board)
      .map((component) => component.pcb_component_id),
  )

  const copperElements = circuitJson.filter(
    (element): element is CopperElement =>
      element.type === "pcb_via" ||
      element.type === "pcb_smtpad" ||
      element.type === "pcb_plated_hole" ||
      element.type === "pcb_copper_pour",
  )
  const componentCcwRotationsById = new Map<string, number>(
    circuitJson
      .filter(
        (element): element is PcbComponent => element.type === "pcb_component",
      )
      .map((component) => [component.pcb_component_id, component.rotation]),
  )

  const errors: PcbPlacementError[] = []
  for (const element of copperElements) {
    if (
      (element.type === "pcb_smtpad" || element.type === "pcb_plated_hole") &&
      element.pcb_component_id &&
      allowedOffBoardComponentIds.has(element.pcb_component_id)
    ) {
      continue
    }

    const geometry = getCopperGeometry(element, componentCcwRotationsById)
    if (!geometry) continue

    const { isInside, clearance } = measureClearance(boardPolygon, geometry)
    if (isInside && clearance + GEOMETRY_EPSILON >= requiredClearance) {
      continue
    }

    const id = getCopperElementId(element)
    const label = getCopperElementLabel(element)
    errors.push({
      type: "pcb_placement_error",
      pcb_placement_error_id: `copper_too_close_to_board_edge_${id}`,
      error_type: "pcb_placement_error",
      message: `${label} ${id} violates copper-to-board-edge clearance (measured ${clearance.toFixed(3)}mm, required ${requiredClearance.toFixed(3)}mm)`,
    })
  }

  return errors
}
