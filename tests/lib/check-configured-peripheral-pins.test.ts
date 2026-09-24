import { expect, test } from "bun:test"
import {
  type AnyCircuitElement,
  type SourcePinAttributes,
  type SourcePort,
  source_component_misconfigured_error,
} from "circuit-json"
import {
  checkConfiguredPeripheralPins,
  runAllPinSpecificationChecks,
} from "../../index"

const pin: SourcePort = {
  type: "source_port",
  source_port_id: "port-a",
  source_component_id: "component-a",
  subcircuit_id: "subcircuit-a",
  name: "GPIO0",
}

const functions = [
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

for (const [label, configured, supported] of functions) {
  test(`${label}: rejects only explicitly unsupported active functions`, () => {
    for (const active of [true, false, undefined]) {
      for (const support of [true, false, undefined]) {
        const errors = checkConfiguredPeripheralPins([
          { ...pin, [configured]: active, [supported]: support },
        ])
        if (active === true && support === false) {
          expect(errors).toHaveLength(1)
          expect(errors[0].message).toContain(label)
          expect(errors[0].source_port_ids).toEqual([pin.source_port_id])
          expect(errors[0].source_component_ids).toEqual([
            pin.source_component_id!,
          ])
          expect(
            source_component_misconfigured_error.safeParse(errors[0]).success,
          ).toBe(true)
        } else {
          expect(errors).toEqual([])
        }
      }
    }
  })
}

test("groups conflicts per pin and includes component names through source references", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "component-a",
      name: "U1",
      ftype: "simple_chip",
    },
    {
      ...pin,
      is_configured_for_i2c_sda: true,
      supports_i2c_sda: false,
      is_configured_for_uart_tx: true,
      supports_uart_tx: false,
      is_configured_for_spi_mosi: true,
      supports_spi_mosi: true,
    },
    {
      ...pin,
      source_port_id: "port-b",
      name: "GPIO1",
      is_configured_for_i2c_scl: true,
      supports_i2c_scl: false,
    },
  ]
  const errors = checkConfiguredPeripheralPins(circuitJson)
  expect(errors).toHaveLength(2)
  expect(errors[0].message).toBe(
    "U1 pin GPIO0 is configured for unsupported peripheral functions: I2C SDA, UART TX",
  )
  expect(errors[1].source_port_ids).toEqual(["port-b"])
  const allIssues = await runAllPinSpecificationChecks(circuitJson)
  expect(
    allIssues.filter(
      (issue) => issue.type === "source_component_misconfigured_error",
    ),
  ).toHaveLength(2)
})

test("does not infer capabilities from pin names or other pins", () => {
  expect(
    checkConfiguredPeripheralPins([
      { ...pin, name: "SDA", is_configured_for_i2c_sda: true },
      { ...pin, source_port_id: "port-b", supports_i2c_sda: false },
    ]),
  ).toEqual([])
  expect(checkConfiguredPeripheralPins([])).toEqual([])
})

test("reports a pin without an owning component", () => {
  const errors = checkConfiguredPeripheralPins([
    {
      ...pin,
      source_component_id: undefined,
      is_configured_for_uart_rx: true,
      supports_uart_rx: false,
    },
  ])
  expect(errors).toHaveLength(1)
  expect(errors[0].source_component_ids).toEqual([])
  expect(errors[0].source_port_ids).toEqual([pin.source_port_id])
  expect(errors[0].message).toContain("Pin GPIO0")
})
