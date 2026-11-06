import { Circuit } from "tscircuit"

const passivePins = { A: { isPassive: true }, B: { isPassive: true } }
const labels = { pin1: "A", pin2: "B" }

// JP_VDDD is reduced from krishnax12/mtr-tiny-md. Other circuits are controls.
export const passiveJumperGroundCases = [
  {
    title: "Passive jumper without ground",
    groundWarnings: 0,
    powerWarnings: 0,
    connectionErrors: 0,
    knownBug: true,
    element: (
      <jumper
        name="JP_VDDD"
        pinLabels={labels}
        pinAttributes={passivePins}
        connections={{ A: "net.V3V3", B: "net.VDDD" }}
      />
    ),
  },
  {
    title: "Passive jumper connected to ground",
    groundWarnings: 0,
    powerWarnings: 0,
    connectionErrors: 0,
    knownBug: false,
    element: (
      <jumper
        name="JP_BOOT"
        pinLabels={labels}
        pinAttributes={{
          A: { isPassive: true },
          B: { isPassive: true, requiresGround: true },
        }}
        connections={{ A: "net.BOOT", B: "net.GND" }}
      />
    ),
  },
  {
    title: "Passive solder jumper without ground",
    groundWarnings: 0,
    powerWarnings: 0,
    connectionErrors: 0,
    knownBug: true,
    element: (
      <solderjumper
        name="SJ1"
        pinLabels={labels}
        pinAttributes={passivePins}
        connections={{ A: "net.V3V3", B: "net.VDDD" }}
      />
    ),
  },
  {
    title: "Active chip missing ground metadata",
    groundWarnings: 1,
    powerWarnings: 0,
    connectionErrors: 0,
    knownBug: false,
    element: (
      <chip
        name="U_ACTIVE"
        pinLabels={labels}
        pinAttributes={{ A: { requiresPower: true }, B: { isInput: true } }}
        connections={{ A: "net.V3V3", B: "net.EN" }}
      />
    ),
  },
  {
    title: "Active chip with power and ground",
    groundWarnings: 0,
    powerWarnings: 0,
    connectionErrors: 0,
    knownBug: false,
    element: (
      <chip
        name="U_OK"
        pinLabels={labels}
        pinAttributes={{
          A: { requiresPower: true },
          B: { requiresGround: true },
        }}
        connections={{ A: "net.V3V3", B: "net.GND" }}
      />
    ),
  },
  {
    title: "Mixed passive and active chip pins",
    groundWarnings: 1,
    powerWarnings: 1,
    connectionErrors: 0,
    knownBug: false,
    element: (
      <chip
        name="U_MIXED"
        pinLabels={labels}
        pinAttributes={{ A: { isPassive: true }, B: { isInput: true } }}
        connections={{ A: "net.SIGNAL", B: "net.EN" }}
      />
    ),
  },
  {
    title: "Unspecified chip pin roles",
    groundWarnings: 1,
    powerWarnings: 1,
    connectionErrors: 0,
    knownBug: false,
    element: (
      <chip
        name="U_UNSPECIFIED"
        pinLabels={labels}
        connections={{ A: "net.SIGNAL", B: "net.EN" }}
      />
    ),
  },
  {
    title: "Required ground contact left floating",
    groundWarnings: 0,
    powerWarnings: 0,
    connectionErrors: 1,
    knownBug: false,
    element: (
      <jumper
        name="JP_FLOATING"
        pinLabels={labels}
        pinAttributes={{
          A: { isPassive: true },
          B: { isPassive: true, requiresGround: true, mustBeConnected: true },
        }}
        connections={{ A: "net.BOOT" }}
      />
    ),
  },
  {
    title: "Required ground contact connected",
    groundWarnings: 0,
    powerWarnings: 0,
    connectionErrors: 0,
    knownBug: false,
    element: (
      <jumper
        name="JP_CONNECTED"
        pinLabels={labels}
        pinAttributes={{
          A: { isPassive: true },
          B: { isPassive: true, requiresGround: true, mustBeConnected: true },
        }}
        connections={{ A: "net.BOOT", B: "net.GND" }}
      />
    ),
  },
]

export async function createPassiveJumperGroundCase(
  scenario: (typeof passiveJumperGroundCases)[number],
) {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(<board routingDisabled>{scenario.element}</board>)
  await circuit.renderUntilSettled()
  return circuit.getCircuitJson()
}
