import type {
  AnyCircuitElement,
  SchematicComponent,
  SchematicError,
  SchematicPort,
  SourcePort,
  SourceSimpleLed,
} from "circuit-json"

/** Ensure every LED source port has a matching schematic port. */
export const checkLedSchematicPorts = (
  circuitJson: AnyCircuitElement[],
): SchematicError[] => {
  const leds = circuitJson.filter(
    (element): element is SourceSimpleLed =>
      element.type === "source_component" && element.ftype === "simple_led",
  )
  const sourcePorts = circuitJson.filter(
    (element): element is SourcePort => element.type === "source_port",
  )
  const schematicComponents = circuitJson.filter(
    (element): element is SchematicComponent =>
      element.type === "schematic_component",
  )
  const schematicPorts = circuitJson.filter(
    (element): element is SchematicPort => element.type === "schematic_port",
  )

  const errors: SchematicError[] = []

  for (const led of leds) {
    const schematicComponent = schematicComponents.find(
      (component) => component.source_component_id === led.source_component_id,
    )
    if (!schematicComponent) {
      errors.push({
        type: "schematic_error",
        schematic_error_id: `led_missing_schematic_component_${led.source_component_id}`,
        error_type: "schematic_port_not_found",
        message: `LED ${led.name} does not have a schematic component`,
        subcircuit_id: led.subcircuit_id,
      })
      continue
    }

    const ledSourcePortIds = sourcePorts
      .filter(
        (sourcePort) =>
          sourcePort.source_component_id === led.source_component_id,
      )
      .map((sourcePort) => sourcePort.source_port_id)
    const representedSourcePortIds = new Set(
      schematicPorts
        .filter(
          (schematicPort) =>
            schematicPort.schematic_component_id ===
            schematicComponent.schematic_component_id,
        )
        .map((schematicPort) => schematicPort.source_port_id),
    )
    const missingSourcePortIds = ledSourcePortIds.filter(
      (sourcePortId) => !representedSourcePortIds.has(sourcePortId),
    )
    if (missingSourcePortIds.length === 0) continue

    errors.push({
      type: "schematic_error",
      schematic_error_id: `led_missing_schematic_ports_${led.source_component_id}`,
      error_type: "schematic_port_not_found",
      message: `LED ${led.name} is missing ${missingSourcePortIds.length} schematic port${missingSourcePortIds.length === 1 ? "" : "s"}`,
      subcircuit_id: led.subcircuit_id,
    })
  }

  return errors
}
