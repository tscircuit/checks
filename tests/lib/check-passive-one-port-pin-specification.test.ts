import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkAllPinsInComponentAreUnderspecified } from "lib/check-all-pins-in-component-are-underspecified"
import { checkNoGroundPinDefined } from "lib/check-no-ground-pin-defined"
import { checkNoPowerPinDefined } from "lib/check-no-power-pin-defined"

const getPowerAndGroundWarningsByComponent = (
  circuitJson: AnyCircuitElement[],
) => {
  const warnings = [
    ...checkNoPowerPinDefined(circuitJson),
    ...checkNoGroundPinDefined(circuitJson),
  ]

  return (sourceComponentId: string) =>
    warnings.filter(
      (warning) => warning.source_component_id === sourceComponentId,
    )
}

describe("passive one-port pin specification", () => {
  test("does not require fake power and ground roles for a chip antenna", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "antenna",
        name: "ANT1",
        ftype: "simple_chip",
      },
      {
        type: "source_port",
        source_port_id: "antenna_feed",
        source_component_id: "antenna",
        name: "FEED",
        must_be_connected: true,
      },
      {
        type: "source_port",
        source_port_id: "antenna_nc",
        source_component_id: "antenna",
        name: "NC",
        do_not_connect: true,
      },
    ]

    expect(
      getPowerAndGroundWarningsByComponent(circuitJson)("antenna"),
    ).toEqual([])
  })

  test("does not require power or ground roles for a passive-only multi-port chip such as a rotary encoder", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "encoder",
        name: "ENC1",
        ftype: "simple_chip",
      },
      {
        type: "source_port",
        source_port_id: "enc_pin6",
        source_component_id: "encoder",
        name: "pin6",
        is_passive: true,
      },
      {
        type: "source_port",
        source_port_id: "enc_pin7",
        source_component_id: "encoder",
        name: "pin7",
        is_passive: true,
      },
      {
        type: "source_port",
        source_port_id: "enc_a",
        source_component_id: "encoder",
        name: "A",
        is_passive: true,
      },
      {
        type: "source_port",
        source_port_id: "enc_c",
        source_component_id: "encoder",
        name: "C",
        is_passive: true,
        requires_ground: true,
      },
      {
        type: "source_port",
        source_port_id: "enc_b",
        source_component_id: "encoder",
        name: "B",
        is_passive: true,
      },
      {
        type: "source_port",
        source_port_id: "enc_d",
        source_component_id: "encoder",
        name: "D",
        is_passive: true,
      },
      {
        type: "source_port",
        source_port_id: "enc_e",
        source_component_id: "encoder",
        name: "E",
        is_passive: true,
        requires_ground: true,
      },
    ]

    expect(
      getPowerAndGroundWarningsByComponent(circuitJson)("encoder"),
    ).toEqual([])
    expect(checkAllPinsInComponentAreUnderspecified(circuitJson)).toEqual([])
  })

  test("keeps checking active chips with multiple connectable ports", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "active_chip",
        name: "U1",
        ftype: "simple_chip",
      },
      {
        type: "source_port",
        source_port_id: "active_chip_pin1",
        source_component_id: "active_chip",
        name: "VDD",
        must_be_connected: true,
      },
      {
        type: "source_port",
        source_port_id: "active_chip_pin2",
        source_component_id: "active_chip",
        name: "GND",
        must_be_connected: true,
      },
      {
        type: "source_port",
        source_port_id: "active_chip_pin3",
        source_component_id: "active_chip",
        name: "IO",
        must_be_connected: true,
      },
    ]

    expect(
      getPowerAndGroundWarningsByComponent(circuitJson)("active_chip").map(
        (warning) => warning.type,
      ),
    ).toEqual([
      "source_no_power_pin_defined_warning",
      "source_no_ground_pin_defined_warning",
    ])
  })
})
