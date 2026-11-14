import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTraceRoutePoint } from "circuit-json"
import { checkPcbTraceViaCounts } from "lib/check-pcb-trace-via-counts"
import { runAllRoutingChecks } from "lib/run-all-checks"

const createTraceCircuitJson = (viaCount: number): AnyCircuitElement[] => [
  {
    type: "source_trace",
    source_trace_id: "source_trace_xtal",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    max_via_count: 0,
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_xtal",
    source_trace_id: "source_trace_xtal",
    route: [
      { route_type: "wire", x: 0, y: 0, width: 0.15, layer: "top" },
      ...Array.from(
        { length: viaCount },
        (_, index): PcbTraceRoutePoint => ({
          route_type: "via",
          x: index + 1,
          y: 0,
          from_layer: index % 2 === 0 ? "top" : "bottom",
          to_layer: index % 2 === 0 ? "bottom" : "top",
        }),
      ),
      { route_type: "wire", x: viaCount + 1, y: 0, width: 0.15, layer: "top" },
    ],
  },
]

test("errors when a PCB trace exceeds max_via_count", async () => {
  const circuitJson = createTraceCircuitJson(2)

  expect(checkPcbTraceViaCounts(circuitJson)).toEqual([
    expect.objectContaining({
      type: "pcb_trace_error",
      pcb_trace_error_id: "max_via_count_exceeded_source_trace_xtal",
      source_trace_id: "source_trace_xtal",
    }),
  ])
  expect(await runAllRoutingChecks(circuitJson)).toEqual(
    expect.arrayContaining(checkPcbTraceViaCounts(circuitJson)),
  )
})

test("accepts a PCB trace within max_via_count", () => {
  expect(checkPcbTraceViaCounts(createTraceCircuitJson(0))).toEqual([])
})

test("ignores vias on unrelated MST branches when exact two-port trace satisfies max_via_count", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_trace",
      source_trace_id: "source_trace_xtal",
      connected_source_port_ids: ["source_port_a", "source_port_b"],
      connected_source_net_ids: [],
      max_via_count: 0,
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_a",
      source_port_id: "source_port_a",
      pcb_component_id: "pcb_component_a",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_b",
      source_port_id: "source_port_b",
      pcb_component_id: "pcb_component_b",
      x: 2,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_branch",
      source_port_id: "source_port_branch",
      pcb_component_id: "pcb_component_branch",
      x: 4,
      y: 0,
      layers: ["bottom"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_exact",
      source_trace_id: "source_trace_xtal",
      route: [
        {
          route_type: "wire",
          x: 0,
          y: 0,
          width: 0.15,
          layer: "top",
          start_pcb_port_id: "pcb_port_a",
        },
        {
          route_type: "wire",
          x: 2,
          y: 0,
          width: 0.15,
          layer: "top",
          end_pcb_port_id: "pcb_port_b",
        },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_unrelated_branch",
      source_trace_id: "source_trace_xtal",
      route: [
        {
          route_type: "wire",
          x: 0,
          y: 0,
          width: 0.15,
          layer: "top",
          start_pcb_port_id: "pcb_port_a",
        },
        {
          route_type: "via",
          x: 2,
          y: 0,
          from_layer: "top",
          to_layer: "bottom",
        },
        {
          route_type: "wire",
          x: 4,
          y: 0,
          width: 0.15,
          layer: "bottom",
          end_pcb_port_id: "pcb_port_branch",
        },
      ],
    },
  ]

  expect(checkPcbTraceViaCounts(circuitJson)).toEqual([])
})
