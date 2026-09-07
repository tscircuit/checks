import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTraceRoutePoint } from "circuit-json"
import { checkPcbTraceViaCounts } from "lib/check-pcb-trace-via-counts"
import { runAllRoutingChecks } from "lib/run-all-checks"

const createTraceCircuitJson = (viaCount: number): AnyCircuitElement[] => [
  {
    type: "source_trace",
    source_trace_id: "source_trace_xtal",
    connected_source_port_ids: [],
    connected_source_net_ids: ["source_net_xtal"],
    max_via_count: 0,
    subcircuit_id: "subcircuit_board",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_xtal",
    source_trace_id: "source_trace_xtal",
    subcircuit_id: "subcircuit_board",
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

test("warns when a PCB trace exceeds max_via_count", async () => {
  const circuitJson = createTraceCircuitJson(2)

  expect(checkPcbTraceViaCounts(circuitJson)).toEqual([
    {
      type: "pcb_trace_too_many_vias_warning",
      pcb_trace_too_many_vias_warning_id:
        "pcb_trace_too_many_vias_warning_source_trace_xtal",
      warning_type: "pcb_trace_too_many_vias_warning",
      message: "PCB trace uses 2 vias, exceeding the 0 maximum",
      pcb_trace_id: "pcb_trace_xtal",
      source_trace_id: "source_trace_xtal",
      source_net_id: "source_net_xtal",
      actual_via_count: 2,
      maximum_via_count: 0,
      subcircuit_id: "subcircuit_board",
    },
  ])
  expect(await runAllRoutingChecks(circuitJson)).toEqual(
    expect.arrayContaining(checkPcbTraceViaCounts(circuitJson)),
  )
})

test("accepts a PCB trace within max_via_count", () => {
  expect(checkPcbTraceViaCounts(createTraceCircuitJson(0))).toEqual([])
})
