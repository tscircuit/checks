// This release emits source_bus; older snapshots keep their existing renderer.
import { Circuit } from "tscircuit-for-length-tests"
import type { ReactElement } from "react"

export const LengthTestTerminal = ({
  name,
  x,
  y,
}: { name: string; x: number; y: number }) => (
  <chip
    name={name}
    pcbX={x}
    pcbY={y}
    pinLabels={{ pin1: "SIGNAL" }}
    footprint={
      <footprint>
        <smtpad
          portHints={["pin1"]}
          pcbX={0}
          pcbY={0}
          width={1}
          height={1}
          shape="rect"
        />
      </footprint>
    }
  />
)

export const renderLengthTestBoard = async (board: ReactElement) => {
  const circuit = new Circuit()
  circuit.add(board)
  await circuit.renderUntilSettled()
  return circuit.getCircuitJson()
}
