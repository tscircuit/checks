import { cju } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  SourceComponentPinsUnderspecifiedWarning,
  SourcePinAttributes,
  SourcePort,
  SourceComponentBase,
} from "circuit-json"

const PIN_ATTRIBUTE_KEYS = [
  "must_be_connected",
  "provides_power",
  "requires_power",
  "provides_ground",
  "requires_ground",
  "provides_voltage",
  "requires_voltage",
  "do_not_connect",
  "include_in_board_pinout",
  "can_use_internal_pullup",
  "is_using_internal_pullup",
  "needs_external_pullup",
  "can_use_internal_pulldown",
  "is_using_internal_pulldown",
  "needs_external_pulldown",
  "can_use_open_drain",
  "is_using_open_drain",
  "can_use_push_pull",
  "is_using_push_pull",
  "should_have_decoupling_capacitor",
  "recommended_decoupling_capacitor_capacitance",
  "is_configured_for_i2c_sda",
  "is_configured_for_i2c_scl",
  "is_configured_for_spi_mosi",
  "is_configured_for_spi_miso",
  "is_configured_for_spi_sck",
  "is_configured_for_spi_cs",
  "is_configured_for_uart_tx",
  "is_configured_for_uart_rx",
  "supports_i2c_sda",
  "supports_i2c_scl",
  "supports_spi_mosi",
  "supports_spi_miso",
  "supports_spi_sck",
  "supports_spi_cs",
  "supports_uart_tx",
  "supports_uart_rx",
] as const satisfies readonly (keyof SourcePinAttributes)[]

function hasAnyPinAttribute(port: SourcePort): boolean {
  return PIN_ATTRIBUTE_KEYS.some((key) => port[key] !== undefined)
}

/**
 * Check that each component with ports has at least one pin attribute
 * specified across its ports. Returns a warning when all pins are
 * underspecified (no SourcePinAttributes fields set on any port).
 */
export function checkAllPinsInComponentAreUnderspecified(
  circuitJson: AnyCircuitElement[],
): SourceComponentPinsUnderspecifiedWarning[] {
  const warnings: SourceComponentPinsUnderspecifiedWarning[] = []
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

    const hasAnySpecifiedAttributes = componentPorts.some((port) =>
      hasAnyPinAttribute(port),
    )

    if (hasAnySpecifiedAttributes) continue

    warnings.push({
      type: "source_component_pins_underspecified_warning",
      source_component_pins_underspecified_warning_id: `source_component_pins_underspecified_warning_${component.source_component_id}`,
      warning_type: "source_component_pins_underspecified_warning",
      message: `All pins on ${component.name} are underspecified (no pinAttributes set)`,
      source_component_id: component.source_component_id,
      source_port_ids: componentPorts.map((port) => port.source_port_id),
      subcircuit_id: componentPorts[0]?.subcircuit_id,
    })
  }

  return warnings
}
