import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkDanglingTraces } from "../../lib/check-dangling-traces/check-dangling-traces"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { traceEndpointExample, wire } from "../fixtures/trace-endpoint-example"

test("a gap breaks the required connection and leaves two exposed endpoints", async () => {
  const circuit = traceEndpointExample({
    title: "BROKEN CONNECTION: A GAP BETWEEN THE PADS",
    explanation: "Contiguity: 1 missing connection. Dangling endpoints: 2.",
    padCenters: [
      { x: -2, y: 0 },
      { x: 2, y: 0 },
    ],
    routes: [
      [wire(-2, 0), wire(-0.4, 0)],
      [wire(0.4, 0), wire(2, 0)],
    ],
  })
  const contiguityErrors = checkTracesAreContiguous(circuit)
  const danglingErrors = checkDanglingTraces(circuit)
  expect(contiguityErrors).toHaveLength(1)
  expect(contiguityErrors[0].pcb_port_ids).toEqual(["port_1"])
  expect(danglingErrors.map((error) => error.pcb_trace_error_id)).toEqual([
    "disconnected_endpoint_trace_0_end",
    "disconnected_endpoint_trace_1_start",
  ])
  await expect(convertCircuitJsonToPcbSvg(circuit)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
