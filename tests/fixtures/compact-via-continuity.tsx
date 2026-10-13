import { RootCircuit } from "@tscircuit/core"
import type { AnyCircuitElement } from "circuit-json"

/** Authored PCB coordinates are board-world mm: +X right and +Y up. */
export async function renderCompactViaContinuity({
  explicitContacts = false,
  viaToLayer = "bottom",
}: {
  explicitContacts?: boolean
  viaToLayer?: "bottom" | "inner1"
} = {}): Promise<AnyCircuitElement[]> {
  const circuit = new RootCircuit()
  const via = {
    x: -0.825,
    y: 3,
    via: true,
    fromLayer: "top" as const,
    toLayer: viaToLayer,
  }
  circuit.add(
    <board width={10} height={10} layers={4} routingDisabled schematicDisabled>
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
        name="RETAINED"
        from="R1.1"
        to="R2.2"
        thickness={0.2}
        pcbPath={
          explicitContacts
            ? [{ x: -0.825, y: 3 }, via, { x: -0.825, y: 3 }]
            : [via]
        }
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  return circuit.getCircuitJson() as AnyCircuitElement[]
}
