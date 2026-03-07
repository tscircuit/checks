import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkAllPinsInComponentAreUnderspecified } from "lib/check-all-pins-in-component-underspecified"

describe("checkAllPinsInComponentAreUnderspecified", () => {
  test("returns an error when all pins on a component are missing pin attributes", () => {
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
        name: "pin1",
      },
      {
        type: "source_port",
        source_port_id: "port_2",
        source_component_id: "component_1",
        name: "pin2",
      },
    ]

    const errors = checkAllPinsInComponentAreUnderspecified(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0].source_component_id).toBe("component_1")
    expect(errors[0].message).toContain("U1")
    expect(errors[0].message).toContain("underspecified")
  })

  test("returns no error when ports include normal pin metadata", () => {
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
        name: "pin1",
        pin_number: 1,
        port_hints: ["1"],
      },
      {
        type: "source_port",
        source_port_id: "port_2",
        source_component_id: "component_1",
        name: "pin2",
        pin_number: 2,
        port_hints: ["2"],
      },
    ]

    const errors = checkAllPinsInComponentAreUnderspecified(circuitJson)
    expect(errors).toHaveLength(0)
  })

  test("returns no error for components without pins", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "component_1",
        name: "U1",
        ftype: "simple_chip",
      },
    ]

    const errors = checkAllPinsInComponentAreUnderspecified(circuitJson)
    expect(errors).toHaveLength(0)
  })
})
