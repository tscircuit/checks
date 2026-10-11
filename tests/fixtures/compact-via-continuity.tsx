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
  const footprint = (
    <footprint>
      <smtpad portHints={["pin1"]} shape="rect" width={0.5} height={0.5} />
    </footprint>
  )
  const via = {
    x: 0,
    y: 3,
    via: true,
    fromLayer: "top" as const,
    toLayer: viaToLayer,
  }
  circuit.add(
    <board width={10} height={10} layers={4} routingDisabled schematicDisabled>
      <chip name="SAVED_START" pcbY={-2} footprint={footprint} />
      <chip
        name="SAVED_END"
        pcbX={2}
        pcbY={1}
        layer="bottom"
        footprint={footprint}
      />
      <trace
        name="RETAINED"
        from="SAVED_START.1"
        to="SAVED_END.1"
        thickness={0.2}
        pcbPath={
          explicitContacts ? [{ x: 0, y: 3 }, via, { x: 0, y: 3 }] : [via]
        }
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  return circuit.getCircuitJson() as AnyCircuitElement[]
}
