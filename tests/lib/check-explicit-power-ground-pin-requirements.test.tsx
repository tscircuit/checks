import { expect, test } from "bun:test"
import { checkNoGroundPinDefined } from "lib/check-no-ground-pin-defined"
import { checkNoPowerPinDefined } from "lib/check-no-power-pin-defined"
import { Circuit } from "tscircuit"

test.failing(
  "explicitly absent pin requirements do not warn about a missing supply",
  async () => {
    const circuit = new Circuit()
    circuit.pcbDisabled = true
    circuit.add(
      <board>
        <chip
          name="U1"
          pinLabels={{ pin1: "A", pin2: "B" }}
          pinAttributes={{
            pin1: { requiresPower: false, requiresGround: false },
            pin2: { requiresPower: false, requiresGround: false },
          }}
        />
        <chip
          name="U2"
          pinLabels={{ pin1: "A", pin2: "B" }}
          pinAttributes={{
            pin1: { requiresPower: false, requiresGround: false },
          }}
        />
        <chip
          name="U3"
          pinLabels={{ pin1: "GND", pin2: "IO" }}
          pinAttributes={{
            pin1: { requiresPower: false, requiresGround: true },
            pin2: { requiresPower: false, requiresGround: false },
          }}
        />
        <chip name="U4" pinLabels={{ pin1: "VDD", pin2: "GND" }} />
      </board>,
    )

    await circuit.renderUntilSettled()
    const circuitJson = circuit.getCircuitJson()

    expect(
      checkNoPowerPinDefined(circuitJson).map(({ message }) => message),
    ).toEqual([
      "U2 has no pin with requires_power=true",
      "U4 has no pin with requires_power=true",
    ])
    expect(
      checkNoGroundPinDefined(circuitJson).map(({ message }) => message),
    ).toEqual([
      "U2 has no pin with requires_ground=true",
      "U4 has no pin with requires_ground=true",
    ])
  },
)
