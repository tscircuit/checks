import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbTraceLengths, runAllRoutingChecks } from "../.."

const circuitJson = [
  {
    type: "source_trace",
    source_trace_id: "overlength_source_trace",
    connected_source_port_ids: [],
    connected_source_net_ids: ["signal_net"],
    max_length: 10,
    subcircuit_id: "board",
  },
  {
    type: "source_trace",
    source_trace_id: "short_source_trace",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    max_length: 10,
  },
  {
    type: "source_trace",
    source_trace_id: "unconstrained_source_trace",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    max_length: null,
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "overlength_pcb_trace",
    source_trace_id: "overlength_source_trace",
    subcircuit_id: "board",
    route: [
      { route_type: "wire", x: 0, y: 0, width: 0.15, layer: "top" },
      { route_type: "wire", x: 12, y: 0, width: 0.15, layer: "top" },
    ],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "short_pcb_trace",
    source_trace_id: "short_source_trace",
    trace_length: 8,
    route: [],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "unconstrained_pcb_trace",
    source_trace_id: "unconstrained_source_trace",
    trace_length: 20,
    route: [],
  },
] as AnyCircuitElement[]

test("warns when a PCB trace exceeds its source trace maximum length", () => {
  expect(checkPcbTraceLengths(circuitJson)).toEqual([
    {
      type: "pcb_trace_too_long_warning",
      pcb_trace_too_long_warning_id:
        "pcb_trace_too_long_warning_overlength_pcb_trace",
      warning_type: "pcb_trace_too_long_warning",
      message: "PCB trace is 12.00mm long, exceeding the 10mm maximum",
      pcb_trace_id: "overlength_pcb_trace",
      source_trace_id: "overlength_source_trace",
      source_net_id: "signal_net",
      actual_trace_length: 12,
      maximum_trace_length: 10,
      subcircuit_id: "board",
    },
  ])
})

test("is included in the routing check pipeline", async () => {
  const results = await runAllRoutingChecks(circuitJson)

  expect(
    results.filter((result) => result.type === "pcb_trace_too_long_warning"),
  ).toEqual(checkPcbTraceLengths(circuitJson))
})

const makePcbPort = (
  pcbPortId: string,
  sourcePortId: string,
): AnyCircuitElement => ({
  type: "pcb_port",
  pcb_port_id: pcbPortId,
  source_port_id: sourcePortId,
  pcb_component_id: `component_${pcbPortId}`,
  x: 0,
  y: 0,
  layers: ["top"],
})

const makeStraightPcbTrace = ({
  pcbTraceId,
  sourceTraceId,
  startPcbPortId,
  endPcbPortId,
  length,
}: {
  pcbTraceId: string
  sourceTraceId: string
  startPcbPortId: string
  endPcbPortId: string
  length: number
}): AnyCircuitElement => ({
  type: "pcb_trace",
  pcb_trace_id: pcbTraceId,
  source_trace_id: sourceTraceId,
  route: [
    {
      route_type: "wire",
      x: 0,
      y: 0,
      width: 0.15,
      layer: "top",
      start_pcb_port_id: startPcbPortId,
    },
    {
      route_type: "wire",
      x: length,
      y: 0,
      width: 0.15,
      layer: "top",
      end_pcb_port_id: endPcbPortId,
    },
  ],
})

test("ignores unrelated long MST branches when exact two-port traces are short", () => {
  const cases = [
    { id: "charger_ground", maximum: 5, exact: 3.94, branch: 10.71 },
    { id: "vdd1_decoupling", maximum: 3, exact: 1.16, branch: 6.47 },
    { id: "regulator_output", maximum: 6, exact: 1.57, branch: 17.37 },
  ]
  const multidropCircuitJson = cases.flatMap(
    ({ id, maximum, exact, branch }): AnyCircuitElement[] => {
      const sourceTraceId = `source_trace_${id}`
      const startSourcePortId = `source_port_${id}_start`
      const endSourcePortId = `source_port_${id}_end`
      const branchSourcePortId = `source_port_${id}_branch`
      const startPcbPortId = `pcb_port_${id}_start`
      const endPcbPortId = `pcb_port_${id}_end`
      const branchPcbPortId = `pcb_port_${id}_branch`

      return [
        {
          type: "source_trace",
          source_trace_id: sourceTraceId,
          connected_source_port_ids: [startSourcePortId, endSourcePortId],
          connected_source_net_ids: [],
          max_length: maximum,
        },
        makePcbPort(startPcbPortId, startSourcePortId),
        makePcbPort(endPcbPortId, endSourcePortId),
        makePcbPort(branchPcbPortId, branchSourcePortId),
        makeStraightPcbTrace({
          pcbTraceId: `pcb_trace_${id}_exact`,
          sourceTraceId,
          startPcbPortId,
          endPcbPortId,
          length: exact,
        }),
        makeStraightPcbTrace({
          pcbTraceId: `pcb_trace_${id}_unrelated_branch`,
          sourceTraceId,
          startPcbPortId,
          endPcbPortId: branchPcbPortId,
          length: branch,
        }),
      ]
    },
  )

  expect(checkPcbTraceLengths(multidropCircuitJson)).toEqual([])
})

test("retains a violation on the exact two-port PCB trace", () => {
  const exactViolationCircuitJson = [
    {
      type: "source_trace",
      source_trace_id: "source_trace_exact_violation",
      connected_source_port_ids: ["source_port_a", "source_port_b"],
      connected_source_net_ids: [],
      max_length: 5,
    },
    makePcbPort("pcb_port_a", "source_port_a"),
    makePcbPort("pcb_port_b", "source_port_b"),
    makePcbPort("pcb_port_branch", "source_port_branch"),
    makeStraightPcbTrace({
      pcbTraceId: "pcb_trace_exact_violation",
      sourceTraceId: "source_trace_exact_violation",
      startPcbPortId: "pcb_port_a",
      endPcbPortId: "pcb_port_b",
      length: 7,
    }),
    makeStraightPcbTrace({
      pcbTraceId: "pcb_trace_unrelated_long_branch",
      sourceTraceId: "source_trace_exact_violation",
      startPcbPortId: "pcb_port_a",
      endPcbPortId: "pcb_port_branch",
      length: 12,
    }),
  ] as AnyCircuitElement[]

  expect(checkPcbTraceLengths(exactViolationCircuitJson)).toEqual([
    expect.objectContaining({
      pcb_trace_id: "pcb_trace_exact_violation",
      source_trace_id: "source_trace_exact_violation",
      actual_trace_length: 7,
      maximum_trace_length: 5,
    }),
  ])
})

test("retains one-port-to-net trace length warnings", () => {
  const portToNetCircuitJson = [
    {
      type: "source_trace",
      source_trace_id: "source_trace_ground_drop",
      connected_source_port_ids: ["source_port_c9_ground"],
      connected_source_net_ids: ["source_net_ground"],
      max_length: 5,
    },
    makePcbPort("pcb_port_c9_ground", "source_port_c9_ground"),
    makePcbPort("pcb_port_c3_ground", "source_port_c3_ground"),
    makeStraightPcbTrace({
      pcbTraceId: "pcb_trace_c9_to_ground",
      sourceTraceId: "source_trace_ground_drop",
      startPcbPortId: "pcb_port_c9_ground",
      endPcbPortId: "pcb_port_c3_ground",
      length: 5.062790456754819,
    }),
  ] as AnyCircuitElement[]

  expect(checkPcbTraceLengths(portToNetCircuitJson)).toEqual([
    expect.objectContaining({
      pcb_trace_id: "pcb_trace_c9_to_ground",
      source_trace_id: "source_trace_ground_drop",
      actual_trace_length: 5.062790456754819,
      maximum_trace_length: 5,
    }),
  ])
})

test("keeps existing attribution when no exact endpoint route is exposed", () => {
  const routeWithoutEndpointMetadata = [
    {
      type: "source_trace",
      source_trace_id: "source_trace_without_endpoint_metadata",
      connected_source_port_ids: ["source_port_a", "source_port_b"],
      connected_source_net_ids: [],
      max_length: 5,
    },
    makePcbPort("pcb_port_a", "source_port_a"),
    makePcbPort("pcb_port_b", "source_port_b"),
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_without_endpoint_metadata",
      source_trace_id: "source_trace_without_endpoint_metadata",
      trace_length: 7,
      route: [],
    },
  ] as AnyCircuitElement[]

  expect(checkPcbTraceLengths(routeWithoutEndpointMetadata)).toEqual([
    expect.objectContaining({
      pcb_trace_id: "pcb_trace_without_endpoint_metadata",
      source_trace_id: "source_trace_without_endpoint_metadata",
      actual_trace_length: 7,
      maximum_trace_length: 5,
    }),
  ])
})
