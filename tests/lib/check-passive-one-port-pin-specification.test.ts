import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
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
