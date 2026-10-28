import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbTrace,
  PcbTraceRoutePoint,
} from "circuit-json"
import { checkPcbTraceViaCounts } from "../../lib/check-pcb-trace-via-counts"

const circuit = (): AnyCircuitElement[] => [
  {
    type: "source_trace",
    source_trace_id: "source",
    connected_source_port_ids: ["s1", "s2"],
    connected_source_net_ids: [],
    max_via_count: 0,
  },
  ...[1, 2, 3].map((i) => ({
    type: "pcb_port" as const,
    pcb_port_id: `p${i}`,
    source_port_id: `s${i}`,
    pcb_component_id: `c${i}`,
    x: i,
    y: 0,
    layers: ["top" as const],
  })),
]

const route = (id: string, end: string, vias: number): PcbTrace => ({
  type: "pcb_trace",
  pcb_trace_id: id,
  source_trace_id: "source",
  route: [
    {
      route_type: "wire",
      x: 0,
      y: 0,
      layer: "top",
      width: 0.2,
      start_pcb_port_id: "p1",
    },
    ...Array.from(
      { length: vias },
      (_, i): PcbTraceRoutePoint => ({
        route_type: "via",
        x: i + 1,
        y: 0,
        from_layer: i % 2 === 0 ? "top" : "bottom",
        to_layer: i % 2 === 0 ? "bottom" : "top",
      }),
    ),
    {
      route_type: "wire",
      x: vias + 2,
      y: 0,
      layer: vias % 2 === 0 ? "top" : "bottom",
      width: 0.2,
      end_pcb_port_id: end,
    },
  ],
})

test("does not count unrelated branch vias against an exact endpoint route", () => {
  expect(
    checkPcbTraceViaCounts([
      ...circuit(),
      route("exact", "p2", 0),
      route("branch", "p3", 2),
    ]),
  ).toEqual([])
})

test("reports only the selected route's vias and trace ID", () => {
  const errors = checkPcbTraceViaCounts([
    ...circuit(),
    route("branch", "p3", 2),
    route("exact", "p2", 1),
  ])
  expect(errors).toEqual([
    expect.objectContaining({
      pcb_trace_id: "exact",
      source_trace_id: "source",
      message: "PCB trace uses 1 vias, exceeding the 0 maximum",
    }),
  ])
})

test("retains fragment aggregation when no exact endpoint route is available", () => {
  const first = route("first", "p3", 1)
  const second = route("second", "p3", 1)
  expect(checkPcbTraceViaCounts([...circuit(), first, second])).toEqual([
    expect.objectContaining({
      message: "PCB trace uses 2 vias, exceeding the 0 maximum",
    }),
  ])
})
