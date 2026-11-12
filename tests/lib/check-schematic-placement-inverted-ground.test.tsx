import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { checkSchematicPlacement } from "../.."
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

test("describes a ground-facing-up finding from the updated analyzer as ground rather than supply", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <net name="GND" isGroundNet />
      <net name="SIGNAL" />
      <capacitor
        name="C1"
        capacitance="100nF"
        schOrientation="vertical"
        connections={{ pin1: "net.GND", pin2: "net.SIGNAL" }}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const json = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  expect(checkSchematicPlacement(json)).toMatchObject([
    {
      styling_issue_type: "inverted_rails",
      message:
        "C1 has its ground pin facing up. Rotate C1 by 180° so that pin faces down, preserving pin connections, and reroute attached traces.",
    },
  ])
})
