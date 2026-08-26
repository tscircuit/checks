import type {
  AnyCircuitElement,
  SchematicComponent,
  SchematicComponentStylingWarning,
  SchematicPort,
} from "circuit-json"

type SourceComponent = Extract<AnyCircuitElement, { type: "source_component" }>

const FLOATING_POINT_TOLERANCE = 1e-9

const getPortLabel = (port: SchematicPort) =>
  port.display_pin_label ?? `pin ${port.pin_number}`

/**
 * Warns when a box-style component's pins are positioned beyond the body edge
 * they enter. Left/right pins are checked against the body's vertical span,
 * while top/bottom pins are checked against its horizontal span.
 */
export function checkSchematicComponentPortsOutsideBody(
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
    if (
      component.is_box_with_pins === false ||
      component.size.width <= 0 ||
      component.size.height <= 0
    ) {
      continue
    }

    const componentLeftX = component.center.x - component.size.width / 2
    const componentRightX = component.center.x + component.size.width / 2
    const componentBottomY = component.center.y - component.size.height / 2
    const componentTopY = component.center.y + component.size.height / 2
    const componentPorts =
      portsByComponentId.get(component.schematic_component_id) ?? []

    const portsOutsideBody = componentPorts
      .filter((port) => {
        if (
          port.side_of_component === "left" ||
          port.side_of_component === "right"
        ) {
          return (
            port.center.y < componentBottomY - FLOATING_POINT_TOLERANCE ||
            port.center.y > componentTopY + FLOATING_POINT_TOLERANCE
          )
        }

        if (
          port.side_of_component === "top" ||
          port.side_of_component === "bottom"
        ) {
          return (
            port.center.x < componentLeftX - FLOATING_POINT_TOLERANCE ||
            port.center.x > componentRightX + FLOATING_POINT_TOLERANCE
          )
        }

        return false
      })
      .sort((portA, portB) => {
        const portAIsVertical =
          portA.side_of_component === "left" ||
          portA.side_of_component === "right"
        const portBIsVertical =
          portB.side_of_component === "left" ||
          portB.side_of_component === "right"

        if (portAIsVertical && portBIsVertical) {
          return portB.center.y - portA.center.y
        }
        if (!portAIsVertical && !portBIsVertical) {
          return portA.center.x - portB.center.x
        }
        return portAIsVertical ? -1 : 1
      })

    if (portsOutsideBody.length === 0) continue

    const requiredHeight = Math.max(
      component.size.height,
      ...portsOutsideBody
        .filter(
          (port) =>
            port.side_of_component === "left" ||
            port.side_of_component === "right",
        )
        .map((port) => 2 * Math.abs(port.center.y - component.center.y)),
    )
    const requiredWidth = Math.max(
      component.size.width,
      ...portsOutsideBody
        .filter(
          (port) =>
            port.side_of_component === "top" ||
            port.side_of_component === "bottom",
        )
        .map((port) => 2 * Math.abs(port.center.x - component.center.x)),
    )

    const suggestedDimensionChanges: string[] = []
    if (requiredHeight > component.size.height + FLOATING_POINT_TOLERANCE) {
      suggestedDimensionChanges.push(
        `increase schHeight to at least ${requiredHeight.toFixed(2)}mm`,
      )
    }
    if (requiredWidth > component.size.width + FLOATING_POINT_TOLERANCE) {
      suggestedDimensionChanges.push(
        `increase schWidth to at least ${requiredWidth.toFixed(2)}mm`,
      )
    }

    const sourceComponent = component.source_component_id
      ? sourceComponentById.get(component.source_component_id)
      : undefined
    const componentName =
      sourceComponent?.name ?? component.schematic_component_id
    const portLabels = portsOutsideBody.map(getPortLabel).join(", ")

    warnings.push({
      type: "schematic_component_styling_warning",
      schematic_component_styling_warning_id: `schematic_component_styling_warning_${component.schematic_component_id}_ports_outside_body`,
      warning_type: "schematic_component_styling_warning",
      message: `${componentName} has schematic pins outside its body (${portLabels}); ${suggestedDimensionChanges.join(" and ")}`,
      schematic_component_id: component.schematic_component_id,
      styling_issue_type: "ports_outside_body",
      schematic_port_ids: portsOutsideBody.map(
        (port) => port.schematic_port_id,
      ),
      source_component_id: component.source_component_id,
      schematic_sheet_id: component.schematic_sheet_id,
      subcircuit_id: component.subcircuit_id,
    })
  }

  return warnings
}
