import { expect, test } from "bun:test"
import { checkNoGroundPinDefined } from "lib/check-no-ground-pin-defined"
import { checkNoPowerPinDefined } from "lib/check-no-power-pin-defined"
import { Circuit } from "tscircuit"

test("discrete MOSFET imports skip the dedicated power and ground pin checks", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <chip name="Q1" pinLabels={{ pin1: "G", pin2: "S", pin3: "D" }} />
      <chip name="U1" pinLabels={{ pin1: "VDD", pin2: "GND", pin3: "OUT" }} />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()

  expect(
    checkNoPowerPinDefined(circuitJson).map(({ message }) => message),
  ).toEqual(["U1 has no pin with requires_power=true"])
  expect(
    checkNoGroundPinDefined(circuitJson).map(({ message }) => message),
  ).toEqual(["U1 has no pin with requires_ground=true"])
})
