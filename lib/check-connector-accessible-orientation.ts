import { getBoardBounds } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbComponent,
  PcbConnectorNotInAccessibleOrientationWarning,
} from "circuit-json"
import { getReadableNameForComponent } from "./util/get-readable-names"

type FacingDirection = "x-" | "x+" | "y+" | "y-"

function getFacingDirectionFromInsertionDirection(
  component: PcbComponent,
): FacingDirection | null {
  switch (component.insertion_direction) {
    case "from_left":
      return "x-"
    case "from_right":
      return "x+"
    case "from_top":
      return "y+"
    case "from_bottom":
      return "y-"
    case "from_above":
    case "from_below":
      return null
    default:
      return null
  }
}

function getFacingDirection(component: PcbComponent): FacingDirection | null {
  if (component.insertion_direction) {
    return getFacingDirectionFromInsertionDirection(component)
  }

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
    const facingDirection = getFacingDirection(component)
    const recommendedFacingDirection = getRecommendedFacingDirection(
      component,
      bounds,
    )

    if (!facingDirection || !recommendedFacingDirection) continue
    if (facingDirection === recommendedFacingDirection) continue

    const sourceComponent = circuitJson.find(
      (element) =>
        element.type === "source_component" &&
        element.source_component_id === component.source_component_id,
    )
    const componentName =
      sourceComponent?.type === "source_component"
        ? sourceComponent.name
        : getReadableNameForComponent(circuitJson, component.pcb_component_id)

    const directionSource = component.insertion_direction
      ? `insertion_direction="${component.insertion_direction}"`
      : "inferred from cable_insertion_center"

    warnings.push({
      type: "pcb_connector_not_in_accessible_orientation_warning",
      warning_type: "pcb_connector_not_in_accessible_orientation_warning",
      pcb_connector_not_in_accessible_orientation_warning_id: `pcb_connector_not_in_accessible_orientation_warning_${component.pcb_component_id}`,
      message: `${componentName} faces ${facingDirection} (${directionSource}), but the nearest board edge is ${recommendedFacingDirection}. For an edge-facing connector, adjust pcbRotation to face ${recommendedFacingDirection}. For vertical mating, set insertionDirection="from_above" or "from_below" on its <footprint>; "from_top" means y+, not above the board.`,
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
