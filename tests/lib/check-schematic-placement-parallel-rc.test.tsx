import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { checkSchematicPlacement } from "../.."
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

test("warns when parallel RC branches are not aligned", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <net name="GND" isGroundNet />
      <chip
        name="U1"
        schX={-3}
        schY={2}
        pinLabels={{ pin1: "A", pin2: "B", pin3: "C" }}
        schPinArrangement={{
          rightSide: {
            pins: ["pin1", "pin2", "pin3"],
            direction: "top-to-bottom",
          },
        }}
      />
      <resistor
        name="R1"
        resistance="10k"
        schRotation={270}
        schX={1}
        schY={1}
      />
      <capacitor
        name="C1"
        capacitance="10nF"
        schOrientation="vertical"
        schX={1}
        schY={-3}
      />
      <trace name="chip_connection" from=".U1 > .A" to=".R1 > .pin1" />
      <trace name="parallel_connection" from=".R1 > .pin1" to=".C1 > .pin1" />
      <trace name="resistor_ground" from=".R1 > .pin2" to="net.GND" />
      <trace name="capacitor_ground" from=".C1 > .pin2" to="net.GND" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const warnings = checkSchematicPlacement(
    normalizeFixtureSourcePorts(circuit.getCircuitJson()),
  )
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    type: "schematic_component_styling_warning",
    styling_issue_type: "parallel_rc_not_aligned",
  })
})
