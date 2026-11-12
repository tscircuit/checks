import { Circuit } from "tscircuit"
import { normalizeFixtureSourcePorts } from "./normalize-fixture-source-ports"

export async function createTraceSimplificationCircuit(resistorX = 0) {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <chip
        name="U1"
        schX={0}
        schY={0}
        schPinArrangement={{
          rightSide: { pins: ["pin1"], direction: "top-to-bottom" },
        }}
      />
      <resistor
        name="R1"
        resistance="100k"
        schX={resistorX}
        schY={2}
        schRotation={90}
      />
      <trace from=".U1 > .pin1" to=".R1 > .pin1" />
    </board>,
  )
  await circuit.renderUntilSettled()
  return normalizeFixtureSourcePorts(circuit.getCircuitJson())
}

export async function createConnectorDetourCircuit(connectorX = 7) {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board schTraceAutoLabelEnabled={false} schMaxTraceDistance={100}>
      <pinheader
        name="J1"
        pinCount={3}
        schX={connectorX}
        schY={0}
        schPinArrangement={{
          rightSide: { pins: [1, 2, 3], direction: "top-to-bottom" },
        }}
      />
      {[1, 2, 3].map((pin) => (
        <resistor
          key={pin}
          name={`R${pin}`}
          resistance="1k"
          schX={-5}
          schY={8 - 4 * pin}
          connections={{ pin1: `.J1 > .pin${pin}` }}
        />
      ))}
    </board>,
  )
  await circuit.renderUntilSettled()
  return normalizeFixtureSourcePorts(circuit.getCircuitJson())
}
