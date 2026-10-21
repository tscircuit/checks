import { Circuit } from "@tscircuit/core"

export default function CopperContactRepro() {
  return (
    <board width={6} height={6}>
      <net name="GND" />
      <testpoint
        name="TP1"
        footprintVariant="pad"
        padDiameter={0.8}
        pcbX={0}
        pcbY={1.5}
        doNotPlace
      />
      <trace
        from=".TP1 > .pin1"
        to="net.GND"
        thickness={0.5}
        pcbPathRelativeTo=".TP1 > .pin1"
        pcbPath={[
          { x: 0, y: 0 },
          { x: -2, y: 0 },
          { x: -2, y: -1.5 },
          { x: 0, y: -1.5 },
        ]}
      />
      {/* The strip crosses the rounded trace end, forcing edge-distance checks. */}
      <copperpour
        layer="top"
        connectsTo="net.GND"
        coveredWithSolderMask={false}
        boardEdgeMargin={0}
        outline={[
          { x: -0.1, y: -2 },
          { x: 0.1, y: -2 },
          { x: 0.1, y: 2 },
          { x: -0.1, y: 2 },
        ]}
      />
    </board>
  )
}

export async function renderRepro() {
  const circuit = new Circuit()
  circuit.add(<CopperContactRepro />)
  await circuit.renderUntilSettled()
  return circuit.getCircuitJson()
}
