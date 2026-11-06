import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkNoGroundPinDefined } from "lib/check-no-ground-pin-defined"
import { checkPinMustBeConnected } from "lib/check-pin-must-be-connected"

test("checkNoGroundPinDefined skips interchangeable contacts without disabling connection checks", () => {
  for (const arePinsInterchangeable of [undefined, false, true]) {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "component",
        name: "U1",
        ftype: "simple_chip",
        are_pins_interchangeable: arePinsInterchangeable,
      },
      {
        type: "source_port",
        source_port_id: "port1",
        source_component_id: "component",
        name: "A",
      },
      {
        type: "source_port",
        source_port_id: "port2",
        source_component_id: "component",
        name: "B",
        must_be_connected: true,
      },
    ]
    const warnings = checkNoGroundPinDefined(circuitJson)
    const errors = checkPinMustBeConnected(circuitJson)

    expect(warnings).toHaveLength(arePinsInterchangeable === true ? 0 : 1)
    expect(errors).toEqual([
      expect.objectContaining({
        message: "Port B on U1 must be connected but is floating",
      }),
    ])
  }
})
