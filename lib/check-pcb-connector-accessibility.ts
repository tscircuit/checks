import type {
  AnyCircuitElement,
  PcbBoard,
  PcbComponent,
  PcbConnectorNotInAccessibleOrientationWarning,
} from "circuit-json"
import { getReadableNameForComponent } from "./util/get-readable-names"

type Direction = "x-" | "x+" | "y-" | "y+"

const getBoardBounds = (
  board: PcbBoard,
): { minX: number; maxX: number; minY: number; maxY: number } | null => {
  if (board.outline && board.outline.length > 0) {
    return {
      minX: Math.min(...board.outline.map((p) => p.x)),
      maxX: Math.max(...board.outline.map((p) => p.x)),
      minY: Math.min(...board.outline.map((p) => p.y)),
      maxY: Math.max(...board.outline.map((p) => p.y)),
    }
  }

  if (
    board.center &&
    typeof board.width === "number" &&
    typeof board.height === "number"
  ) {
    return {
      minX: board.center.x - board.width / 2,
      maxX: board.center.x + board.width / 2,
      minY: board.center.y - board.height / 2,
      maxY: board.center.y + board.height / 2,
    }
  }

  return null
}

const getFacingDirection = ({
  component,
}: {
  component: PcbComponent
}): Direction | null => {
  if (!component.center || !component.cable_insertion_center) return null

  const dx = component.cable_insertion_center.x - component.center.x
  const dy = component.cable_insertion_center.y - component.center.y

  if (dx === 0 && dy === 0) return null

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "x+" : "x-"
  }

  return dy >= 0 ? "y+" : "y-"
}

const getRecommendedFacingDirection = ({
  x,
  y,
  bounds,
}: {
  x: number
  y: number
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
}): Direction => {
  const distanceToBoundaries: Record<Direction, number> = {
    "x-": Math.abs(x - bounds.minX),
    "x+": Math.abs(bounds.maxX - x),
    "y-": Math.abs(y - bounds.minY),
    "y+": Math.abs(bounds.maxY - y),
  }

  return (Object.entries(distanceToBoundaries).sort(
    (a, b) => a[1] - b[1],
  )[0]?.[0] ?? "x+") as Direction
}

export const checkPcbConnectorAccessibility = (
  circuitJson: AnyCircuitElement[],
): PcbConnectorNotInAccessibleOrientationWarning[] => {
  const board = circuitJson.find(
    (element): element is PcbBoard => element.type === "pcb_board",
  )

  if (!board) return []

  const boardBounds = getBoardBounds(board)
  if (!boardBounds) return []

  const warnings: PcbConnectorNotInAccessibleOrientationWarning[] = []

  for (const element of circuitJson) {
    if (element.type !== "pcb_component") continue
    if (!element.cable_insertion_center) continue

    const facingDirection = getFacingDirection({ component: element })
    if (!facingDirection) continue

    const recommendedFacingDirection = getRecommendedFacingDirection({
      x: element.cable_insertion_center.x,
      y: element.cable_insertion_center.y,
      bounds: boardBounds,
    })

    if (facingDirection === recommendedFacingDirection) continue

    const componentName = getReadableNameForComponent(
      circuitJson,
      element.pcb_component_id,
    )

    warnings.push({
      type: "pcb_connector_not_in_accessible_orientation_warning",
      warning_type: "pcb_connector_not_in_accessible_orientation_warning",
      pcb_connector_not_in_accessible_orientation_warning_id: `pcb_connector_not_in_accessible_orientation_warning_${element.pcb_component_id}`,
      message: `Connector ${componentName} is facing ${facingDirection} but should face ${recommendedFacingDirection} so the cable exits the board edge.`,
      pcb_component_id: element.pcb_component_id,
      pcb_board_id: board.pcb_board_id,
      source_component_id: element.source_component_id,
      facing_direction: facingDirection,
      recommended_facing_direction: recommendedFacingDirection,
      subcircuit_id: element.subcircuit_id,
    })
  }

  return warnings
}
