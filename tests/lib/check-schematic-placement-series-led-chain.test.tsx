import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { checkSchematicPlacement } from "../.."
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

test("warns when a series LED chain is not ordered", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <led name="LED1" schX={0} />
      <led name="LED2" schX={12} />
      <led name="LED3" schX={6} />
      <trace name="first_link" from=".LED1 > .cathode" to=".LED2 > .anode" />
      <trace name="second_link" from=".LED2 > .cathode" to=".LED3 > .anode" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const warnings = checkSchematicPlacement(
    normalizeFixtureSourcePorts(circuit.getCircuitJson()),
  )
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    type: "schematic_component_styling_warning",
    styling_issue_type: "series_led_chain_not_ordered",
    message:
      "The series chain LED1, LED2, LED3 requires long connections behind LED pins. Arrange the LEDs in their connected order, preserving anode/cathode connections, and reroute affected traces. A horizontal, vertical, or clearly connected folded chain is acceptable.",
  })
})
