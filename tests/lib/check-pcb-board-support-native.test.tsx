import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbBoardSupport } from "../../lib/check-pcb-board-support"

test("native TSX panel reports tabs consumed by staggered neighboring routes", async () => {
  const circuit = new Circuit()
  circuit.add(
    <panel
      width={80}
      height={80}
      layoutMode="none"
      panelizationMethod="tab-routing"
    >
      <board width={20} height={20} pcbX={0} pcbY={0} routingDisabled />
      <board width={20} height={20} pcbX={22} pcbY={6} routingDisabled />
      <board width={20} height={20} pcbX={-22} pcbY={6} routingDisabled />
      <board width={20} height={20} pcbX={6} pcbY={22} routingDisabled />
      <board width={20} height={20} pcbX={6} pcbY={-22} routingDisabled />
    </panel>,
  )
  await circuit.renderUntilSettled()
  const errors = checkPcbBoardSupport(circuit.getCircuitJson())
  expect(
    errors.some(
      (error) =>
        Math.hypot(error.center.x, error.center.y) < 1 &&
        error.support_count === 0,
    ),
  ).toBe(true)
  const svg = convertCircuitJsonToPcbSvg(
    [...circuit.getCircuitJson(), ...errors],
    {
      shouldDrawErrors: true,
      showSolderMask: true,
      backgroundColor: "white",
      colorOverrides: { drill: "white" },
      width: 650,
      height: 650,
    },
  )
  expect(svg).toContain("0 surviving tabs")
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
