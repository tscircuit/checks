import { getBoardBounds } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbComponent,
  PcbConnectorNotInAccessibleOrientationWarning,
} from "circuit-json"
import { getReadableNameForComponent } from "./util/get-readable-names"

type FacingDirection = "x-" | "x+" | "y+" | "y-"
type SourceComponentElement = Extract<
  AnyCircuitElement,
  { type: "source_component" }
>

const FLEX_SOCKET_PATTERN =
  /(?:^|[^a-z0-9])(?:(?:fpc|ffc)(?:\d+|[^a-z0-9]|$)|fh\d{2}[a-z0-9-]*)/i

function isFlexSocketIdentifier(value: string | undefined): boolean {
  return Boolean(value && FLEX_SOCKET_PATTERN.test(value))
}

function isInternalOrFlexSocket(
  component: PcbComponent,
  sourceComponent: SourceComponentElement | undefined,
): boolean {
  if (
    (component as { accessible_from_board_edge?: boolean })
      .accessible_from_board_edge === false ||
    (sourceComponent as { accessible_from_board_edge?: boolean } | undefined)
      ?.accessible_from_board_edge === false
  ) {
    return true
  }

  const standard = (sourceComponent as { standard?: string } | undefined)
    ?.standard
  if (standard === "fpc" || standard === "ffc") {
    return true
  }

  const kicadFootprint = component.metadata?.kicad_footprint
  const identifiers = [
    kicadFootprint?.footprintName,
    kicadFootprint?.properties?.Value?.value,
    kicadFootprint?.properties?.Description?.value,
    sourceComponent?.manufacturer_part_number,
    sourceComponent?.display_value,
    sourceComponent?.display_name,
  ]

  return identifiers.some(isFlexSocketIdentifier)
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

  const sourceComponentById = new Map<string, SourceComponentElement>()
  for (const el of circuitJson) {
    if (el.type === "source_component") {
      sourceComponentById.set(el.source_component_id, el)
    }
  }

  for (const component of components) {
    const sourceComponent = sourceComponentById.get(
      component.source_component_id,
    )
    // A pin header is normally accessed perpendicular to the PCB. Only an
    // explicit insertion direction can establish that it is a right-angle part.
    if (
      !component.insertion_direction &&
      sourceComponent?.ftype === "simple_pin_header"
    )
      continue

    if (isInternalOrFlexSocket(component, sourceComponent)) continue

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
