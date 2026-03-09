import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkAllPinsInComponentAreUnderspecified } from "lib/check-all-pins-in-component-are-underspecified"

describe("checkAllPinsInComponentAreUnderspecified", () => {
  test("returns an error when all ports on a component are missing pinAttributes", () => {
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

    const errors = checkAllPinsInComponentAreUnderspecified(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0].source_component_id).toBe("component_1")
    expect(errors[0].source_port_ids).toEqual(["port_1", "port_2"])
    expect(errors[0].message).toContain("All pins on U1 are underspecified")
  })

  test("returns no error when at least one port on a component has pinAttributes", () => {
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
        must_be_connected: false,
      },
    ]

    const errors = checkAllPinsInComponentAreUnderspecified(circuitJson)
    expect(errors).toHaveLength(0)
  })

  test("only returns errors for components whose all ports are underspecified", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "component_1",
        name: "U1",
        ftype: "simple_chip",
      },
      {
        type: "source_component",
        source_component_id: "component_2",
        name: "U2",
        ftype: "simple_chip",
      },
      {
        type: "source_port",
        source_port_id: "u1_port_1",
        source_component_id: "component_1",
        name: "IO1",
      },
      {
        type: "source_port",
        source_port_id: "u2_port_1",
        source_component_id: "component_2",
        name: "IO1",
        provides_power: true,
      },
    ]

    const errors = checkAllPinsInComponentAreUnderspecified(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0].source_component_id).toBe("component_1")
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

    const errors = checkAllPinsInComponentAreUnderspecified(circuitJson)
    expect(errors).toHaveLength(0)
  })
})
