import type {
  AnyCircuitElement,
  SchematicComponent,
  SchematicComponentStylingWarning,
  SchematicPort,
} from "circuit-json"

type SourceComponent = Extract<AnyCircuitElement, { type: "source_component" }>

const DEFAULT_PIN_SPACING = 0.2
const MAX_TOP_PADDING_IN_PIN_SPACINGS = 3
const FLOATING_POINT_TOLERANCE = 1e-9

/**
 * Warns when the left/right pins of a box-style schematic component are
 * clustered far below the top of its body. This commonly happens when an
 * unnecessarily large schematic height is set on a chip or connector.
 */
export function checkSchematicComponentExcessiveTopPadding(
  circuitJson: AnyCircuitElement[],
): SchematicComponentStylingWarning[] {
  const schematicComponents = circuitJson.filter(
    (element): element is SchematicComponent =>
      element.type === "schematic_component",
  )
  const schematicPorts = circuitJson.filter(
    (element): element is SchematicPort => element.type === "schematic_port",
  )
  const sourceComponents = circuitJson.filter(
    (element): element is SourceComponent =>
      element.type === "source_component",
  )

  const sourceComponentById = new Map(
    sourceComponents.map((component) => [
      component.source_component_id,
      component,
    ]),
  )
  const portsByComponentId = new Map<string, SchematicPort[]>()

  for (const port of schematicPorts) {
    if (!port.schematic_component_id) continue
    const componentPorts =
      portsByComponentId.get(port.schematic_component_id) ?? []
    componentPorts.push(port)
    portsByComponentId.set(port.schematic_component_id, componentPorts)
  }

  const warnings: SchematicComponentStylingWarning[] = []

  for (const component of schematicComponents) {
    if (!component.is_box_with_pins || component.size.height <= 0) continue

    const sidePorts = (
      portsByComponentId.get(component.schematic_component_id) ?? []
    ).filter(
      (port) =>
        port.side_of_component === "left" || port.side_of_component === "right",
    )

    // A single side pin does not establish a meaningful vertical pin group.
    if (sidePorts.length < 2) continue

    const highestPinY = Math.max(...sidePorts.map((port) => port.center.y))
    const componentTopY = component.center.y + component.size.height / 2
    const topPadding = componentTopY - highestPinY
    const pinSpacing = component.pin_spacing ?? DEFAULT_PIN_SPACING
    const maximumTopPadding = pinSpacing * MAX_TOP_PADDING_IN_PIN_SPACINGS

    if (
      topPadding <= maximumTopPadding + FLOATING_POINT_TOLERANCE ||
      topPadding <= 0
    ) {
      continue
    }

    const sourceComponent = component.source_component_id
      ? sourceComponentById.get(component.source_component_id)
      : undefined
    const componentName =
      sourceComponent?.name ?? component.schematic_component_id

    warnings.push({
      type: "schematic_component_styling_warning",
      schematic_component_styling_warning_id: `schematic_component_styling_warning_${component.schematic_component_id}_excessive_top_padding`,
      warning_type: "schematic_component_styling_warning",
      message: `${componentName} has excessive empty space above its pins (${topPadding.toFixed(2)}mm, more than ${MAX_TOP_PADDING_IN_PIN_SPACINGS} pin spacings)`,
      schematic_component_id: component.schematic_component_id,
      styling_issue_type: "excessive_top_padding",
      schematic_port_ids: sidePorts.map((port) => port.schematic_port_id),
      source_component_id: component.source_component_id,
      schematic_sheet_id: component.schematic_sheet_id,
      subcircuit_id: component.subcircuit_id,
    })
  }

  return warnings
}
