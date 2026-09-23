import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkDanglingTraces } from "../../lib/check-dangling-traces/check-dangling-traces"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"

test("generated antenna open end is intentional in both routing checks", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={30} height={25} schematicDisabled routingDisabled>
      <antenna name="Radio" antennaShape="2.4ghz_quarter_wave_monopole" />
      <pcbnotetext
        text="Generated antenna: open end is intentional"
        pcbY={-9}
        fontSize={0.6}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  // The released core does not emit the proposed Circuit JSON marker yet.
  // This antenna-only fixture explicitly supplies the producer's future output.
  const circuitJson = circuit
    .getCircuitJson()
    .map((element) =>
      element.type === "pcb_trace"
        ? { ...element, is_antenna_trace: true }
        : element,
    )
  expect(checkDanglingTraces(circuitJson)).toEqual([])
  expect(checkTracesAreContiguous(circuitJson)).toEqual([])
  await expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
