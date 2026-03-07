import type { AnyCircuitElement, SourcePort } from "circuit-json"
import { cju } from "@tscircuit/circuit-json-util"

type SourceComponentAllPinsUnderspecifiedError = {
  type: "source_component_all_pins_underspecified_error"
  source_component_all_pins_underspecified_error_id: string
  error_type: "source_component_all_pins_underspecified_error"
  message: string
  source_component_id: string
  subcircuit_id?: string
}

function hasPinAttributes(port: SourcePort): boolean {
  if ("pinAttributes" in port) return port.pinAttributes != null
  if ("pin_attributes" in port) return port.pin_attributes != null
  return false
}

function hasPinMetadata(port: SourcePort): boolean {
  return port.pin_number !== undefined || (port.port_hints?.length ?? 0) > 0
}

export function checkAllPinsInComponentAreUnderspecified(
  circuitJson: AnyCircuitElement[],
): SourceComponentAllPinsUnderspecifiedError[] {
  const db = cju(circuitJson)
  const sourceComponents = db.source_component.list()
  const sourcePorts = db.source_port.list()

  const portsByComponent = new Map<string, SourcePort[]>()
  for (const port of sourcePorts) {
    if (!port.source_component_id) continue
    const ports = portsByComponent.get(port.source_component_id)
    if (ports) {
      ports.push(port)
    } else {
      portsByComponent.set(port.source_component_id, [port])
    }
  }

  const errors: SourceComponentAllPinsUnderspecifiedError[] = []

  for (const component of sourceComponents) {
    const ports = portsByComponent.get(component.source_component_id) ?? []
    if (ports.length === 0) continue

    const allPinsUnderspecified = ports.every(
      (port) => !hasPinAttributes(port) && !hasPinMetadata(port),
    )
    if (!allPinsUnderspecified) continue

    errors.push({
      type: "source_component_all_pins_underspecified_error",
      source_component_all_pins_underspecified_error_id: `source_component_all_pins_underspecified_error_${component.source_component_id}`,
      error_type: "source_component_all_pins_underspecified_error",
      message: `All pins on ${component.name} are underspecified: no pin attributes or pin metadata found`,
      source_component_id: component.source_component_id,
      subcircuit_id: component.subcircuit_id,
    })
  }

  return errors
}
