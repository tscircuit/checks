import { cju } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  SourceComponentBase,
  SourceNoGroundPinDefinedWarning,
  SourcePort,
} from "circuit-json"

/**
 * Check that each chip has at least one pin marked as requires_ground=true.
 * Returns warnings for chips where no pin declares requires_ground.
 */
export function checkNoGroundPinDefined(
  circuitJson: AnyCircuitElement[],
): SourceNoGroundPinDefinedWarning[] {
  const warnings: SourceNoGroundPinDefinedWarning[] = []
  const db = cju(circuitJson)

  const sourceComponents = db.source_component.list() as SourceComponentBase[]
  const sourcePorts = db.source_port.list() as SourcePort[]

  const portsByComponent = new Map<string, SourcePort[]>()
  for (const port of sourcePorts) {
    if (!port.source_component_id) continue
    const existing = portsByComponent.get(port.source_component_id) ?? []
    existing.push(port)
    portsByComponent.set(port.source_component_id, existing)
  }

  for (const component of sourceComponents) {
    if (component.ftype !== "simple_chip") continue

    const componentPorts =
      portsByComponent.get(component.source_component_id) ?? []
    if (componentPorts.length === 0) continue

    const hasRequiredGroundPin = componentPorts.some(
      (port) => port.requires_ground === true,
    )
    if (hasRequiredGroundPin) continue

    warnings.push({
      type: "source_no_ground_pin_defined_warning",
      source_no_ground_pin_defined_warning_id: `source_no_ground_pin_defined_warning_${component.source_component_id}`,
      warning_type: "source_no_ground_pin_defined_warning",
      message: `${component.name} has no pin with requires_ground=true`,
      source_component_id: component.source_component_id,
      source_port_ids: componentPorts.map((port) => port.source_port_id),
      subcircuit_id: componentPorts[0]?.subcircuit_id,
    })
  }

  return warnings
}
