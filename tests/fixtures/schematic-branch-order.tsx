import { Circuit } from "tscircuit"
import { normalizeFixtureSourcePorts } from "./normalize-fixture-source-ports"

// Published placement extract: ShiboSoftwareDev/usb-pd-quad-dc-motor-controller.
// The original DRV8847 symbol, pin order and two 300-milliohm shunts are retained.
const labels = {
  pin1: ["nSLEEP"],
  pin2: ["OUT1"],
  pin3: ["ISEN12"],
  pin4: ["OUT2"],
  pin5: ["OUT4"],
  pin6: ["ISEN34"],
  pin7: ["OUT3"],
  pin8: ["nFAULT"],
  pin9: ["IN3"],
  pin10: ["IN4"],
  pin11: ["TRQ"],
  pin12: ["VM"],
  pin13: ["GND"],
  pin14: ["MODE"],
  pin15: ["IN2"],
  pin16: ["IN1"],
  pin17: ["EP", "thermalpad"],
} as const
export default function BranchOrder({
  corrected = false,
}: {
  corrected?: boolean
}) {
  return (
    <board routingDisabled>
      <net name="GND" isGroundNet />
      <chip
        footprint="dfn16_thermalpad2.1mmx2.03mm_pillpads_p0.65mm_w7.5mm_pw0.34mm_pl1.75mm"
        name="U_DRV12"
        manufacturerPartNumber="DRV8847PWPR"
        schX={-5.2875}
        schY={-1.645}
        schWidth={1.3}
        schHeight={2}
        schPinSpacing={0.2}
        pinLabels={labels}
        pinAttributes={{ pin13: { requiresGround: true } }}
        schPinArrangement={{
          leftSide: {
            pins: [1, 2, 3, 4, 5, 6, 7, 8, 9],
            direction: "top-to-bottom",
          },
          rightSide: {
            pins: [17, 16, 15, 14, 13, 12, 11, 10],
            direction: "top-to-bottom",
          },
        }}
        connections={{
          pin3: ".RS_M1 > .pin1",
          pin6: ".RS_M2 > .pin1",
          pin11: "net.GND",
          pin13: "net.GND",
          pin14: "net.GND",
          pin17: "net.GND",
        }}
      />
      <resistor
        footprint="1206"
        name="RS_M1"
        resistance="0.3"
        schX={corrected ? -9 : -7.3275}
        schY={corrected ? -1.7 : -3.445}
        schRotation={270}
        connections={{ pin2: "net.GND" }}
      />
      <resistor
        footprint="1206"
        name="RS_M2"
        resistance="0.3"
        schX={-7.3275}
        schY={-2.145}
        schRotation={270}
        connections={{ pin2: "net.GND" }}
      />
    </board>
  )
}
export async function createBranchOrder(corrected = false) {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(<BranchOrder corrected={corrected} />)
  await circuit.renderUntilSettled()
  return normalizeFixtureSourcePorts(circuit.getCircuitJson())
}
