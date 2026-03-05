import { getBoardBounds } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbComponent,
  PcbConnectorNotInAccessibleOrientationWarning,
} from "circuit-json"
import { getReadableNameForComponent } from "./util/get-readable-names"

type FacingDirection = "x-" | "x+" | "y+" | "y-"

function getFacingDirection(component: PcbComponent): FacingDirection | null {
  if (!component.center || !component.cable_insertion_center) return null

  const dx = component.cable_insertion_center.x - component.center.x
  const dy = component.cable_insertion_center.y - component.center.y

  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return null

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "x+" : "x-"
  }

  return dy >= 0 ? "y+" : "y-"
}

function getRecommendedFacingDirection(
  component: PcbComponent,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): FacingDirection | null {
  if (!component.center) return null

  const distances = [
    { direction: "x-" as const, distance: component.center.x - bounds.minX },
    { direction: "x+" as const, distance: bounds.maxX - component.center.x },
    { direction: "y-" as const, distance: component.center.y - bounds.minY },
    { direction: "y+" as const, distance: bounds.maxY - component.center.y },
  ]

  distances.sort((a, b) => a.distance - b.distance)
  return distances[0]?.direction ?? null
}

export function checkConnectorAccessibleOrientation(
  circuitJson: AnyCircuitElement[],
): PcbConnectorNotInAccessibleOrientationWarning[] {
  const board = circuitJson.find(
    (el): el is PcbBoard => el.type === "pcb_board",
  )
  if (!board) return []

  const bounds = (() => {
    try {
      return getBoardBounds(board)
    } catch {
      return null
    }
  })()
  if (!bounds) return []

  const warnings: PcbConnectorNotInAccessibleOrientationWarning[] = []

  const components = circuitJson.filter(
    (el): el is PcbComponent => el.type === "pcb_component",
  )

  for (const component of components) {
    if (!component.cable_insertion_center) continue

    const facingDirection = getFacingDirection(component)
    const recommendedFacingDirection = getRecommendedFacingDirection(
      component,
      bounds,
    )

    if (!facingDirection || !recommendedFacingDirection) continue
    if (facingDirection === recommendedFacingDirection) continue

    const componentName = getReadableNameForComponent(
      circuitJson,
      component.pcb_component_id,
    )

    warnings.push({
      type: "pcb_connector_not_in_accessible_orientation_warning",
      warning_type: "pcb_connector_not_in_accessible_orientation_warning",
      pcb_connector_not_in_accessible_orientation_warning_id: `pcb_connector_not_in_accessible_orientation_warning_${component.pcb_component_id}`,
      message: `${componentName} is facing ${facingDirection} but should face ${recommendedFacingDirection} so the connector is accessible from the board edge`,
      pcb_component_id: component.pcb_component_id,
      source_component_id: component.source_component_id,
      pcb_board_id: board.pcb_board_id,
      facing_direction: facingDirection,
      recommended_facing_direction: recommendedFacingDirection,
      subcircuit_id: component.subcircuit_id,
    })
  }

  return warnings
}
