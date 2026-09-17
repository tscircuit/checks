import { expect, test } from "bun:test"
import {
  any_circuit_element,
  type AnyCircuitElement,
  type PcbTrace,
  type SourceBus,
} from "circuit-json"
import { checkPcbBusLengthSkew, runAllRoutingChecks } from "../.."
import { getPcbTraceLength } from "../../lib/util/get-pcb-trace-length"

const bus = (skew: number | undefined = 1): SourceBus => ({
  type: "source_bus",
  source_bus_id: "bus",
  source_trace_ids: ["a", "b"],
  max_length_skew: skew,
  subcircuit_id: "board",
})
const trace = (id: string, length: number): PcbTrace => ({
  type: "pcb_trace",
  pcb_trace_id: `pcb_${id}`,
  source_trace_id: id,
  trace_length: length,
  route: [],
})

test("reports a typed error with measured skew and member IDs", () => {
  const errors = checkPcbBusLengthSkew([bus(), trace("a", 10), trace("b", 12)])
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    source_bus_id: "bus",
    actual_length_skew: 2,
    maximum_length_skew: 1,
    source_trace_ids: ["a", "b"],
    pcb_trace_ids: ["pcb_a", "pcb_b"],
    subcircuit_id: "board",
  })
  expect(any_circuit_element.parse(errors[0])).toEqual(errors[0])
})

test("accepts equality, zero skew, and floating-point boundary noise", () => {
  expect(
    checkPcbBusLengthSkew([bus(), trace("a", 10), trace("b", 11)]),
  ).toEqual([])
  expect(
    checkPcbBusLengthSkew([bus(0), trace("a", 10), trace("b", 10)]),
  ).toEqual([])
  expect(
    checkPcbBusLengthSkew([bus(0.1), trace("a", 0.2), trace("b", 0.3)]),
  ).toEqual([])
  expect(
    checkPcbBusLengthSkew([bus(0), trace("a", 10), trace("b", 10.01)]),
  ).toHaveLength(1)
})

test("skips unconstrained, unrouted, and single-member buses", () => {
  const unconstrained = bus()
  delete unconstrained.max_length_skew
  expect(
    checkPcbBusLengthSkew([unconstrained, trace("a", 1), trace("b", 20)]),
  ).toEqual([])
  expect(checkPcbBusLengthSkew([bus(), trace("a", 10)])).toEqual([])
  expect(
    checkPcbBusLengthSkew([
      bus(),
      trace("a", 10),
      { ...trace("b", 0), trace_length: undefined },
    ]),
  ).toEqual([])
  expect(
    checkPcbBusLengthSkew([
      { ...bus(), source_trace_ids: ["a", "a"] },
      trace("a", 10),
    ]),
  ).toEqual([])
})

test("sums fragments once per member and ignores unrelated traces", () => {
  expect(
    checkPcbBusLengthSkew([
      { ...bus(0), source_trace_ids: ["a", "b", "a"] },
      trace("a", 4),
      { ...trace("a", 6), pcb_trace_id: "pcb_a_part2" },
      trace("b", 10),
      trace("unrelated", 100),
    ]),
  ).toEqual([])
})

test("measures wire, via, and through-pad segments without skipping or double counting", () => {
  const route: PcbTrace = {
    ...trace("a", 0),
    trace_length: undefined,
    route: [
      { route_type: "wire", x: 0, y: 0, layer: "top", width: 0.2 },
      { route_type: "via", x: 3, y: 4, from_layer: "top", to_layer: "bottom" },
      { route_type: "wire", x: 6, y: 8, layer: "bottom", width: 0.2 },
      {
        route_type: "through_pad",
        start: { x: 6, y: 8 },
        end: { x: 8, y: 8 },
        start_layer: "bottom",
        end_layer: "bottom",
        width: 1,
      },
      { route_type: "wire", x: 8, y: 11, layer: "bottom", width: 0.2 },
    ],
  }
  expect(getPcbTraceLength(route)).toBeCloseTo(16.6)
  expect(getPcbTraceLength({ ...route, trace_length: 20 })).toBe(20)
  expect(
    checkPcbBusLengthSkew([bus(), route, trace("b", 10)])[0]!
      .actual_length_skew,
  ).toBeCloseTo(6.6)
})

test("routing pipeline emits the bus error", async () => {
  const circuit: AnyCircuitElement[] = [bus(), trace("a", 10), trace("b", 12)]
  expect(
    (await runAllRoutingChecks(circuit)).filter(
      (e) => e.type === "pcb_bus_length_skew_error",
    ),
  ).toEqual(checkPcbBusLengthSkew(circuit))
})

test("matches exact endpoints without including unrelated branches", () => {
  const source: AnyCircuitElement = {
    type: "source_trace",
    source_trace_id: "a",
    connected_source_port_ids: ["s1", "s2"],
    connected_source_net_ids: [],
  }
  const ports: AnyCircuitElement[] = [1, 2, 3].map((i) => ({
    type: "pcb_port",
    pcb_port_id: `p${i}`,
    source_port_id: `s${i}`,
    pcb_component_id: `c${i}`,
    x: 0,
    y: 0,
    layers: ["top"],
  }))
  const routed = (id: string, end: string, length: number): PcbTrace => ({
    ...trace("a", length),
    pcb_trace_id: id,
    route: [
      {
        route_type: "wire",
        x: 0,
        y: 0,
        layer: "top",
        width: 0.2,
        start_pcb_port_id: "p1",
      },
      {
        route_type: "wire",
        x: length,
        y: 0,
        layer: "top",
        width: 0.2,
        end_pcb_port_id: end,
      },
    ],
  })
  expect(
    checkPcbBusLengthSkew([
      bus(0),
      source,
      ...ports,
      routed("exact", "p2", 10),
      routed("branch", "p3", 100),
      trace("b", 10),
    ]),
  ).toEqual([])
})

test("bus membership uses IDs and cannot leak between same-named subcircuits", () => {
  const buses = [
    {
      ...bus(0),
      name: "DATA",
      source_bus_id: "bus_left",
      subcircuit_id: "left",
    },
    {
      ...bus(0),
      name: "DATA",
      source_bus_id: "bus_right",
      source_trace_ids: ["c", "d"],
      subcircuit_id: "right",
    },
  ]
  expect(
    checkPcbBusLengthSkew([
      ...buses,
      trace("a", 10),
      trace("b", 10),
      trace("c", 20),
      trace("d", 22),
    ]),
  ).toEqual([
    expect.objectContaining({
      source_bus_id: "bus_right",
      subcircuit_id: "right",
      actual_length_skew: 2,
    }),
  ])
})
