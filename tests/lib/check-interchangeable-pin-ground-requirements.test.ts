import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkNoGroundPinDefined } from "lib/check-no-ground-pin-defined"
import { checkPinMustBeConnected } from "lib/check-pin-must-be-connected"

test("only interchangeable contacts skip ground presence; required connections remain checked", () => {
  for (const interchangeable of [undefined, false, true]) {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "component",
        name: "U1",
        ftype: "simple_chip",
        are_pins_interchangeable: interchangeable,
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
    expect(checkNoGroundPinDefined(circuitJson)).toHaveLength(
      interchangeable === true ? 0 : 1,
    )
    expect(checkPinMustBeConnected(circuitJson)).toEqual([
      expect.objectContaining({
        message: "Port B on U1 must be connected but is floating",
      }),
    ])
  }
})
