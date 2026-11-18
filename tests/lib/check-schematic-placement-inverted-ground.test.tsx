import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { checkSchematicPlacement } from "../.."
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

test("does not report a ground-facing-up capacitor on a signal net as inverted rails", async () => {
  // Inverted rails only apply to parts between a positive supply and ground.
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
  expect(checkSchematicPlacement(json)).toEqual([])
})
