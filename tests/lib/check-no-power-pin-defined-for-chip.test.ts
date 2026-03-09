import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkNoPowerPinDefinedForChip } from "lib/check-no-power-pin-defined-for-chip"

describe("checkNoPowerPinDefinedForChip", () => {
  test("returns warning when chip has no requires_power pin", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "component_1",
        name: "U1",
        ftype: "simple_chip",
      },
      {
        type: "source_port",
        source_port_id: "port_1",
        source_component_id: "component_1",
        name: "IO1",
      },
      {
        type: "source_port",
        source_port_id: "port_2",
        source_component_id: "component_1",
        name: "IO2",
      },
    ]

    const warnings = checkNoPowerPinDefinedForChip(circuitJson)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].type).toBe("source_chip_no_power_pin_defined_warning")
    expect(warnings[0].source_component_id).toBe("component_1")
  })

  test("returns no warning when at least one pin has requires_power=true", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "component_1",
        name: "U1",
        ftype: "simple_chip",
      },
      {
        type: "source_port",
        source_port_id: "port_1",
        source_component_id: "component_1",
        name: "VCC",
        requires_power: true,
      },
      {
        type: "source_port",
        source_port_id: "port_2",
        source_component_id: "component_1",
        name: "IO2",
      },
    ]

    const warnings = checkNoPowerPinDefinedForChip(circuitJson)
    expect(warnings).toHaveLength(0)
  })

  test("ignores non-chip components", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "component_1",
        name: "R1",
        ftype: "simple_resistor",
        resistance: 1000,
      },
      {
        type: "source_port",
        source_port_id: "port_1",
        source_component_id: "component_1",
        name: "pos",
      },
      {
        type: "source_port",
        source_port_id: "port_2",
        source_component_id: "component_1",
        name: "neg",
      },
    ]

    const warnings = checkNoPowerPinDefinedForChip(circuitJson)
    expect(warnings).toHaveLength(0)
  })
})
