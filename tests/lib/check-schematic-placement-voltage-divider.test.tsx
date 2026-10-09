import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { checkSchematicPlacement } from "../.."
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

test("warns when the supply resistor is below the ground resistor", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <net name="V12" isPowerNet />
      <net name="GND" isGroundNet />
      <resistor
        name="R1"
        resistance="10k"
        schRotation={270}
        schX={-2}
        schY={-3}
      />
      <resistor
        name="R2"
        resistance="68k"
        schRotation={270}
        schX={1}
        schY={2}
      />
      <chip
        name="U1"
        schX={5}
        schY={1}
        pinLabels={{ pin1: "ADC" }}
        schPinArrangement={{
          leftSide: { pins: ["pin1"], direction: "top-to-bottom" },
        }}
      />
      <trace name="supply" from=".R1 > .pin1" to="net.V12" />
      <trace name="divider_tap" from=".R1 > .pin2" to=".R2 > .pin1" />
      <trace name="ground" from=".R2 > .pin2" to="net.GND" />
      <trace name="sense" from=".R2 > .pin1" to=".U1 > .ADC" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const warnings = checkSchematicPlacement(
    normalizeFixtureSourcePorts(circuit.getCircuitJson()),
  )
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    type: "schematic_component_styling_warning",
    styling_issue_type: "voltage_divider_supply_resistor_below_ground_resistor",
    message:
      "R1, connected to the supply, is below R2, connected to ground. Place R1 above R2 so their shared divider tap is easy to follow. Preserve pin connections and reroute affected traces; exact alignment is not required.",
  })
})
