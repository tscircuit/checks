import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkNoPowerPinDefined } from "lib/check-no-power-pin-defined"

describe("checkNoPowerPinDefined", () => {
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

    const warnings = checkNoPowerPinDefined(circuitJson)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].type).toBe("source_no_power_pin_defined_warning")
    expect(warnings[0].warning_type).toBe("source_no_power_pin_defined_warning")
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

    const warnings = checkNoPowerPinDefined(circuitJson)
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

    const warnings = checkNoPowerPinDefined(circuitJson)
    expect(warnings).toHaveLength(0)
  })
})

const chip = (
  ports: Partial<Record<"is_passive" | "requires_ground", boolean>>[],
): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "component_1",
    name: "D1",
    ftype: "simple_chip",
  },
  ...ports.map((attributes, i) => ({
    type: "source_port" as const,
    source_port_id: `port_${i + 1}`,
    source_component_id: "component_1",
    name: `P${i + 1}`,
    ...attributes,
  })),
]

describe("checkNoPowerPinDefined on passive chips", () => {
  test("skips a chip whose connected pins are all passive, such as a diode pair", () => {
    expect(
      checkNoPowerPinDefined(
        chip([
          { is_passive: true },
          { is_passive: true },
          { is_passive: true },
        ]),
      ),
    ).toHaveLength(0)
  })

  test("skips a chip whose pins are passive apart from its ground pins, such as a TVS array", () => {
    expect(
      checkNoPowerPinDefined(
        chip([
          { is_passive: true },
          { is_passive: true },
          { requires_ground: true },
        ]),
      ),
    ).toHaveLength(0)
  })

  test("still warns when a pin is neither passive nor ground", () => {
    expect(
      checkNoPowerPinDefined(
        chip([{ is_passive: true }, {}, { requires_ground: true }]),
      ),
    ).toHaveLength(1)
  })
})
