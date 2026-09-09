import {
  type AnyCircuitElement,
  type SourceComponentMisconfiguredError,
  type SourcePinAttributes,
  source_component_misconfigured_error,
} from "circuit-json"

const peripheralFunctions = [
  ["I2C SDA", "is_configured_for_i2c_sda", "supports_i2c_sda"],
  ["I2C SCL", "is_configured_for_i2c_scl", "supports_i2c_scl"],
  ["SPI MOSI", "is_configured_for_spi_mosi", "supports_spi_mosi"],
  ["SPI MISO", "is_configured_for_spi_miso", "supports_spi_miso"],
  ["SPI SCK", "is_configured_for_spi_sck", "supports_spi_sck"],
  ["SPI CS", "is_configured_for_spi_cs", "supports_spi_cs"],
  ["UART TX", "is_configured_for_uart_tx", "supports_uart_tx"],
  ["UART RX", "is_configured_for_uart_rx", "supports_uart_rx"],
] as const satisfies ReadonlyArray<
  readonly [string, keyof SourcePinAttributes, keyof SourcePinAttributes]
>

/** Report configured functions explicitly declared unsupported; absent support is unknown. */
export function checkConfiguredPeripheralPins(
  circuitJson: AnyCircuitElement[],
): SourceComponentMisconfiguredError[] {
  type SourceComponentId = string
  const componentNames = new Map<SourceComponentId, string>()
  for (const component of circuitJson) {
    if (component.type === "source_component") {
      componentNames.set(component.source_component_id, component.name)
    }
  }

  const errors: SourceComponentMisconfiguredError[] = []
  for (const port of circuitJson) {
    if (port.type !== "source_port") continue
    const unsupportedFunctions = peripheralFunctions
      .filter(
        ([, configured, supported]) =>
          port[configured] === true && port[supported] === false,
      )
      .map(([label]) => label)
    if (unsupportedFunctions.length === 0) continue

    let pinDescription = `Pin ${port.name}`
    const sourceComponentIds: SourceComponentId[] = []
    if (port.source_component_id) {
      sourceComponentIds.push(port.source_component_id)
      const componentName = componentNames.get(port.source_component_id)
      if (componentName) pinDescription = `${componentName} pin ${port.name}`
    }

    errors.push(
      source_component_misconfigured_error.parse({
        type: "source_component_misconfigured_error",
        message: `${pinDescription} is configured for unsupported peripheral functions: ${unsupportedFunctions.join(", ")}`,
        source_component_ids: sourceComponentIds,
        source_port_ids: [port.source_port_id],
      }),
    )
  }
  return errors
}
