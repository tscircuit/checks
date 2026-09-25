import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import { checkCopperToBoardEdgeClearance } from "lib/check-copper-to-board-edge-clearance"

test("repro: circular mounting copper fits but its bounds cross the rounded board", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={48.575} height={49.545} borderRadius={2.5} routingDisabled>
      <chip
        name="H1"
        pcbX={21.3875}
        pcbY={22.1}
        footprint={
          <footprint>
            <platedhole shape="circle" holeDiameter={2.2} outerDiameter={4.4} />
          </footprint>
        }
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit
    .getCircuitJson()
    .filter((element) => element.type !== "pcb_component_outside_board_error")
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(checkCopperToBoardEdgeClearance(circuitJson)).toHaveLength(0)
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("0.21mm")
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      viewport: { minX: 18, minY: 18, maxX: 26, maxY: 26 },
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
