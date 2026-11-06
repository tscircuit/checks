import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkNoGroundPinDefined } from "lib/check-no-ground-pin-defined"

test("checkNoGroundPinDefined skips only explicitly interchangeable contacts", () => {
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
      },
    ]
    const warnings = checkNoGroundPinDefined(circuitJson)

    expect(warnings).toHaveLength(arePinsInterchangeable === true ? 0 : 1)
  }
})
