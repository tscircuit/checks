import { getBoardBounds } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbComponent,
  PcbConnectorNotInAccessibleOrientationWarning,
} from "circuit-json"
import { getReadableNameForComponent } from "./util/get-readable-names"

type FacingDirection = "x-" | "x+" | "y+" | "y-"

const RIGHT_ANGLE_HEADER_PATTERN =
  /right[\s_-]*angle|\b90\s*(?:deg|°)|\br\/a\b|-ra\b/i

function isThroughHolePinHeaderSource(el: AnyCircuitElement): boolean {
  if (el.type !== "source_component") return false
  if (el.ftype === "simple_pin_header") return true
  const mpn =
    "manufacturer_part_number" in el &&
    typeof el.manufacturer_part_number === "string"
      ? el.manufacturer_part_number
      : ""
  if (
    /\b(?:pin[\s_-]*)?header/i.test(mpn) &&
    !RIGHT_ANGLE_HEADER_PATTERN.test(mpn)
  ) {
    return true
  }
  return false
}

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

  const sourceComponentById = new Map(
    circuitJson
      .filter((el) => el.type === "source_component")
      .map((el) => [el.source_component_id, el]),
  )

  const platedHoleComponentIds = new Set(
    circuitJson.flatMap((el) =>
      el.type === "pcb_plated_hole" &&
      "pcb_component_id" in el &&
      typeof el.pcb_component_id === "string"
        ? [el.pcb_component_id]
        : [],
    ),
  )
  const smtPadComponentIds = new Set(
    circuitJson.flatMap((el) =>
      el.type === "pcb_smtpad" &&
      "pcb_component_id" in el &&
      typeof el.pcb_component_id === "string"
        ? [el.pcb_component_id]
        : [],
    ),
  )

  const isPerpendicularHeaderWithoutExplicitDirection = (
    component: PcbComponent,
  ): boolean => {
    const source = component.source_component_id
      ? sourceComponentById.get(component.source_component_id)
      : undefined
    if (source && isThroughHolePinHeaderSource(source)) {
      return true
    }
    if (
      source?.ftype === "simple_chip" &&
      platedHoleComponentIds.has(component.pcb_component_id) &&
      !smtPadComponentIds.has(component.pcb_component_id)
    ) {
      const mpn =
        "manufacturer_part_number" in source &&
        typeof source.manufacturer_part_number === "string"
          ? source.manufacturer_part_number
          : ""
      if (!RIGHT_ANGLE_HEADER_PATTERN.test(mpn)) {
        return true
      }
    }
    return false
  }

  for (const component of components) {
    // A pin header is normally accessed perpendicular to the PCB. Only an
    // explicit insertion direction can establish that it is a right-angle part.
    if (
      !component.insertion_direction &&
      isPerpendicularHeaderWithoutExplicitDirection(component)
    )
      continue
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

    const message = component.insertion_direction
      ? `${componentName} is facing ${facingDirection} but should face ${recommendedFacingDirection} so the connector is accessible from the board edge`
      : `${componentName} is inferred to face ${facingDirection} from its cable insertion center because no explicit footprint insertionDirection is defined, but should face ${recommendedFacingDirection} so the connector is accessible from the board edge. Set insertionDirection on the <footprint> to specify the actual direction in the footprint's unrotated orientation; for example, <footprint insertionDirection="from_above"> for a connector accessed from above the PCB (+Z).`

    warnings.push({
      type: "pcb_connector_not_in_accessible_orientation_warning",
      warning_type: "pcb_connector_not_in_accessible_orientation_warning",
      pcb_connector_not_in_accessible_orientation_warning_id: `pcb_connector_not_in_accessible_orientation_warning_${component.pcb_component_id}`,
      message,
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
