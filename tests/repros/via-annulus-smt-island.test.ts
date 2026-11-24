import { expect, test } from "bun:test"
import { lcdEscape } from "./via-annulus-smt-fixture"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"

test("a stale endpoint ID on a separate same-net island cannot reach the landing", () => {
  const circuit = lcdEscape()
  circuit.unshift({
    type: "pcb_trace",
    pcb_trace_id: "isolated",
    source_trace_id: "source_trace",
    route: [
      {
        route_type: "wire",
        x: -1,
        y: 0.5,
        layer: "top",
        width: 0.1,
        start_pcb_port_id: "port",
      },
      { route_type: "wire", x: -0.5, y: 0.5, layer: "top", width: 0.1 },
    ],
  })
  expect(
    checkTracesAreContiguous(circuit).map((e) => e.pcb_trace_id),
  ).toContain("isolated")
})
