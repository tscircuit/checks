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
  checks.checkDanglingTraces,
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

test("reports each dangling endpoint once and keeps required-port errors", async () => {
  const circuit: AnyCircuitElement[] = [
    {
      type: "source_trace",
      source_trace_id: "source_trace_1",
      connected_source_port_ids: ["source_port_1"],
      connected_source_net_ids: [],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_1",
      source_port_id: "source_port_1",
      pcb_component_id: "pcb_component_1",
      x: 5,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_1",
      pcb_port_id: "pcb_port_1",
      shape: "rect",
      x: 5,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_1",
      source_trace_id: "source_trace_1",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
        { route_type: "wire", x: 2, y: 0, width: 0.2, layer: "top" },
      ],
    },
  ]
  const contiguityErrors = checks.checkTracesAreContiguous(circuit)
  expect(contiguityErrors).toHaveLength(1)
  expect(contiguityErrors[0].pcb_port_ids).toEqual(["pcb_port_1"])
  const errors = await checks.runAllRoutingChecks(circuit)
  const endpointIds = errors
    .filter((error) => error.type === "pcb_trace_error")
    .map((error) => error.pcb_trace_error_id)
    .filter((id) => id.startsWith("disconnected_endpoint_"))
  expect(endpointIds.sort()).toEqual([
    "disconnected_endpoint_pcb_trace_1_end",
    "disconnected_endpoint_pcb_trace_1_start",
  ])
  expect(errors).toContainEqual(contiguityErrors[0])
})

test("net-level dangling endpoints are emitted by only one routing check", async () => {
  const circuit: AnyCircuitElement[] = [
    {
      type: "source_trace",
      source_trace_id: "source_trace_net",
      connected_source_port_ids: [],
      connected_source_net_ids: ["source_net_1"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_net",
      source_trace_id: "source_trace_net",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
        { route_type: "wire", x: 2, y: 0, width: 0.2, layer: "top" },
      ],
    },
  ]
  expect(checks.checkTracesAreContiguous(circuit)).toEqual([])
  const endpointErrors = (await checks.runAllRoutingChecks(circuit)).filter(
    (error) =>
      error.type === "pcb_trace_error" &&
      error.pcb_trace_error_id.startsWith("disconnected_endpoint_"),
  )
  expect(endpointErrors).toEqual(checks.checkDanglingTraces(circuit))
  expect(endpointErrors).toHaveLength(2)
})
