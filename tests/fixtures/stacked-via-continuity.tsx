import { RootCircuit } from "@tscircuit/core"
import type { AnyCircuitElement } from "circuit-json"

/** Two authored blind barrels meet at INNER1 without changing compiled copper. */
export async function renderStackedViaContinuity(): Promise<
  AnyCircuitElement[]
> {
  const circuit = new RootCircuit()
  const contact = { x: -0.825, y: 3 }
  circuit.add(
    <board
      width={10}
      height={10}
      layers={4}
      routingDisabled
      schematicDisabled
      allowBlindAndBuriedVias
    >
      <resistor
        name="R1"
        resistance="10k"
        footprint="0603"
        pcbX={0.825}
        pcbY={-2}
      />
      <resistor
        name="R2"
        resistance="10k"
        footprint="0603"
        pcbX={2.825}
        pcbY={1}
        layer="bottom"
      />
      <trace
        name="STACKED"
        from="R1.1"
        to="R2.2"
        thickness={0.2}
        pcbPath={[
          contact,
          { ...contact, via: true, fromLayer: "top", toLayer: "inner1" },
          contact,
          { ...contact, via: true, fromLayer: "inner1", toLayer: "bottom" },
          contact,
        ]}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  return circuit.getCircuitJson() as AnyCircuitElement[]
}
