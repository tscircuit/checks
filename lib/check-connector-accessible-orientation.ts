import { getBoardBounds } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  CadComponent,
  PcbBoard,
  PcbComponent,
  PcbConnectorNotInAccessibleOrientationWarning,
  SourceComponentBase,
} from "circuit-json"
import { getReadableNameForComponent } from "./util/get-readable-names"

type FacingDirection = "x-" | "x+" | "y+" | "y-"

type ConnectorAccessibilityFields = {
  accessible_from_board_edge?: boolean
  accessibleFromBoardEdge?: boolean
  is_accessible_from_board_edge?: boolean
  internal?: boolean
  is_internal?: boolean
  footprinter_string?: string
  standard?: string
}

const FOOTPRINTER_FLEX_SOCKET_RE = /^(fpc|ffc)(?=\d|_|-|$)/i
const FLEX_SOCKET_DESCRIPTOR_RE =
  /\b(?:fpc\d*|ffc\d*|fh\d{2}[a-z]*|board[-_\s]+to[-_\s]+flex|flex[-_\s]+(?:socket|connector|receptacle))\b/i

function getExplicitAccessibleFromBoardEdge(
  record?: ConnectorAccessibilityFields,
): boolean | undefined {
  if (!record) return undefined
  if (typeof record.accessible_from_board_edge === "boolean") {
    return record.accessible_from_board_edge
  }
  if (typeof record.accessibleFromBoardEdge === "boolean") {
    return record.accessibleFromBoardEdge
  }
  if (typeof record.is_accessible_from_board_edge === "boolean") {
    return record.is_accessible_from_board_edge
  }
  if (typeof record.internal === "boolean") {
    return !record.internal
  }
  if (typeof record.is_internal === "boolean") {
    return !record.is_internal
  }
  return undefined
}

function isInternalOrFlexSocketConnector(
  component: PcbComponent,
  sourceComponent: SourceComponentBase | undefined,
  cadComponents: CadComponent[],
): boolean {
  const pcbAccessible = getExplicitAccessibleFromBoardEdge(
    component as PcbComponent & ConnectorAccessibilityFields,
  )
  if (pcbAccessible !== undefined) return !pcbAccessible

  const sourceAccessible = getExplicitAccessibleFromBoardEdge(
    sourceComponent as SourceComponentBase & ConnectorAccessibilityFields,
  )
  if (sourceAccessible !== undefined) return !sourceAccessible

  if (sourceComponent?.ftype === "interconnect") return true

  const footprinterStrings = [
    (component as PcbComponent & ConnectorAccessibilityFields)
      .footprinter_string,
    ...cadComponents.map((cad) => cad.footprinter_string),
  ]
  for (const fp of footprinterStrings) {
    if (fp && FOOTPRINTER_FLEX_SOCKET_RE.test(fp.trim())) {
      return true
    }
  }

  const kicad = component.metadata?.kicad_footprint
  const descriptors = [
    (
      sourceComponent as
        | (SourceComponentBase & ConnectorAccessibilityFields)
        | undefined
    )?.standard,
    sourceComponent?.manufacturer_part_number,
    sourceComponent?.display_name,
    sourceComponent?.display_value,
    kicad?.footprintName,
    kicad?.model?.path,
    kicad?.properties?.Value?.value,
    kicad?.properties?.Description?.value,
  ]

  return descriptors.some(
    (value) =>
      typeof value === "string" && FLEX_SOCKET_DESCRIPTOR_RE.test(value),
  )
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

  const sourceComponentsById = new Map<string, SourceComponentBase>()
  const cadComponentsByPcbId = new Map<string, CadComponent[]>()
  const cadComponentsBySourceId = new Map<string, CadComponent[]>()

  for (const el of circuitJson) {
    if (el.type === "source_component") {
      sourceComponentsById.set(el.source_component_id, el)
    } else if (el.type === "cad_component") {
      if (el.pcb_component_id) {
        const list = cadComponentsByPcbId.get(el.pcb_component_id) ?? []
        list.push(el)
        cadComponentsByPcbId.set(el.pcb_component_id, list)
      }
      if (el.source_component_id) {
        const list = cadComponentsBySourceId.get(el.source_component_id) ?? []
        list.push(el)
        cadComponentsBySourceId.set(el.source_component_id, list)
      }
    }
  }

  for (const component of components) {
    const sourceComponent = sourceComponentsById.get(
      component.source_component_id,
    )
    const cadComponents = [
      ...(cadComponentsByPcbId.get(component.pcb_component_id) ?? []),
      ...(cadComponentsBySourceId.get(component.source_component_id) ?? []),
    ]

    if (
      isInternalOrFlexSocketConnector(component, sourceComponent, cadComponents)
    )
      continue

    // A pin header is normally accessed perpendicular to the PCB. Only an
    // explicit insertion direction can establish that it is a right-angle part.
    if (
      !component.insertion_direction &&
      sourceComponent?.ftype === "simple_pin_header"
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
