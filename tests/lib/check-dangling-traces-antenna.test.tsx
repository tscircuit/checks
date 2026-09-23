import { expect, test } from "bun:test"
import { Circuit, PcbTrace } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkDanglingTraces } from "../../lib/check-dangling-traces/check-dangling-traces"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"

test("intentional antenna copper does not exempt a dangling feed branch", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={20} height={14} schematicDisabled>
      <antenna
        name="Radio"
        antennaShape="2.4ghz_quarter_wave_monopole"
        pcbPath={[
          { x: 0, y: 0 },
          { x: 0, y: 3 },
          { x: 5, y: 3 },
        ]}
      />
      <pcbnotetext
        text="Antenna end: intentional. Feed branch: dangling."
        pcbY={-4}
        fontSize={0.5}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const radiator = circuit.db.pcb_trace.list()[0]!
  const board = circuit.children[0]!
  board.add(
    new PcbTrace({
      source_trace_id: radiator.source_trace_id,
      route: [
        { route_type: "wire", x: 0, y: 2, width: 0.2, layer: "top" },
        { route_type: "wire", x: -3, y: 2, width: 0.2, layer: "top" },
      ],
    }),
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const errors = checkDanglingTraces(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].center).toEqual({ x: -3, y: 2 })
  expect(errors[0].message).toContain("dangling endpoint")
  expect(checkTracesAreContiguous(circuitJson)).toEqual([])
  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
