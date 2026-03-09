import { cju } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  SourcePinAttributes,
  SourcePort,
} from "circuit-json"
import { source_pin_attributes } from "circuit-json"

type SourceComponent = Extract<AnyCircuitElement, { type: "source_component" }>

type SourceComponentPinsUnderspecifiedError = {
  type: "source_component_pins_underspecified_error"
  source_component_pins_underspecified_error_id: string
  error_type: "source_component_pins_underspecified_error"
  message: string
  source_component_id: string
  source_port_ids: string[]
  subcircuit_id?: string
}

const PIN_ATTRIBUTE_KEYS = Object.keys(
  source_pin_attributes.shape,
) as (keyof SourcePinAttributes)[]

function hasAnyPinAttribute(port: SourcePort): boolean {
  return PIN_ATTRIBUTE_KEYS.some((key) => port[key] !== undefined)
}

/**
 * Check that each component with ports has at least one pin attribute
 * specified across its ports. Returns an error when all pins are
 * underspecified (no SourcePinAttributes fields set on any port).
 */
export function checkAllPinsInComponentAreUnderspecified(
  circuitJson: AnyCircuitElement[],
): SourceComponentPinsUnderspecifiedError[] {
  const errors: SourceComponentPinsUnderspecifiedError[] = []
  const db = cju(circuitJson)

  const sourceComponents = db.source_component.list() as SourceComponent[]
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

    const hasAnySpecifiedAttributes = componentPorts.some((port) =>
      hasAnyPinAttribute(port),
    )

    if (hasAnySpecifiedAttributes) continue

    errors.push({
      type: "source_component_pins_underspecified_error",
      source_component_pins_underspecified_error_id: `source_component_pins_underspecified_error_${component.source_component_id}`,
      error_type: "source_component_pins_underspecified_error",
      message: `All pins on ${component.name} are underspecified (no pinAttributes set)`,
      source_component_id: component.source_component_id,
      source_port_ids: componentPorts.map((port) => port.source_port_id),
      subcircuit_id: componentPorts[0]?.subcircuit_id,
    })
  }

  return errors
}
