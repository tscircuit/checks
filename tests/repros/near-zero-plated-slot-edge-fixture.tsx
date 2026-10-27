import { Circuit } from "@tscircuit/core"

// Native source only: the nearly circular slot, rotation and world placement
// leave a positive-length edge below Flatten's zero tolerance after scaling.
const circuit = new Circuit({ platform: { routingDrcChecksDisabled: true } })
circuit.add(
  <board width={10} height={50} routingDisabled>
    <net name="SIGNAL" />
    <chip
      name="J1"
      pcbX={0}
      pcbY={20}
      pinLabels={{ pin1: ["CONTACT"] }}
      connections={{ pin1: "net.SIGNAL" }}
      footprint={
        <footprint>
          <platedhole
            portHints={["pin1"]}
            shape="pill"
            pcbRotation={90}
            outerWidth={3}
            outerHeight={2}
            holeWidth={1.0000000000010001}
            holeHeight={1}
          />
        </footprint>
      }
    />
    <testpoint
      name="TP1"
      pcbX={2}
      pcbY={20}
      layer="bottom"
      footprintVariant="pad"
      padDiameter={0.1}
      connections={{ pin1: "net.SIGNAL" }}
    />
    <testpoint
      name="TP2"
      pcbX={0}
      pcbY={22}
      layer="bottom"
      footprintVariant="pad"
      padDiameter={0.1}
      connections={{ pin1: "net.SIGNAL" }}
    />
    <trace
      from=".TP1 > .pin1"
      to=".TP2 > .pin1"
      thickness={0.1}
      pcbPath={[{ x: -2, y: 0 }]}
    />
  </board>,
)
await circuit.renderUntilSettled()
export const circuitJson = circuit.getCircuitJson()
