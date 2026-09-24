import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import * as checks from "../../index"

const independentChecks = [
  checks.checkEachPcbPortConnectedToPcbTraces,
  checks.checkSourceTracesHavePcbTraces,
  checks.checkPcbTraceLengths,
  checks.checkPcbBusLengthSkew,
  checks.checkPcbTraceViaCounts,
  checks.checkEachPcbTraceNonOverlapping,
  checks.checkCopperPourShorts,
  checks.checkPadTraceClearance,
  checks.checkViaTraceClearance,
  checks.checkViaPadClearance,
  checks.checkSameNetViaSpacing,
  checks.checkDifferentNetViaSpacing,
  checks.checkTracesAreContiguous,
  checks.checkPcbTracesOutOfBoard,
]

test("routing maps include inferred endpoints and are rebuilt after editing the same array", async () => {
  const circuit: AnyCircuitElement[] = [
    ...[0, 1].map((i) => ({
      type: "pcb_port" as const,
      pcb_port_id: `p${i}`,
      source_port_id: `s${i}`,
      pcb_component_id: `c${i}`,
      x: i * 2,
      y: 0,
      layers: ["top" as const],
    })),
    {
      type: "source_trace",
      source_trace_id: "st",
      connected_source_port_ids: ["s0"],
      connected_source_net_ids: ["power"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "t",
      source_trace_id: "st",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
        { route_type: "wire", x: 2, y: 0, width: 0.2, layer: "top" },
      ],
    },
  ]
  const checkAgainstIndependent = async () => {
    const copy = structuredClone(circuit)
    const expected = independentChecks.map((check) => check(copy)).flat()
    const actual = await checks.runAllRoutingChecks(circuit)
    expect(actual).toEqual(expected)
    return actual
  }
  const before = await checkAgainstIndependent()
  const trace = circuit.find((e) => e.type === "pcb_trace")!
  if (trace.type !== "pcb_trace") throw new Error("Missing trace")
  trace.route = []
  const after = await checkAgainstIndependent()
  expect(after).not.toEqual(before)
})
