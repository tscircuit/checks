import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkDanglingTraces } from "../../lib/check-dangling-traces/check-dangling-traces"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { traceEndpointExample, wire } from "../fixtures/trace-endpoint-example"

test("a T junction ending on three pads is connected and has no dangling end", async () => {
  const circuit = traceEndpointExample({
    title: "VALID T JUNCTION: ALL THREE ENDS REACH PADS",
    explanation: "Contiguity: 0 errors. Dangling endpoints: 0.",
    padCenters: [
      { x: -2, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1.3 },
    ],
    routes: [
      [wire(-2, 0), wire(2, 0)],
      [wire(0, 0), wire(0, 1.3)],
    ],
  })
  expect(checkTracesAreContiguous(circuit)).toEqual([])
  expect(checkDanglingTraces(circuit)).toEqual([])
  await expect(convertCircuitJsonToPcbSvg(circuit)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
