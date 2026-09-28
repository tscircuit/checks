import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  LayerRef,
  PcbTrace,
  PcbTraceRoutePoint,
  SourceTrace,
} from "circuit-json"
import { checkPcbTraceUncoupledLength, runAllRoutingChecks } from "../../index"

const source = (
  id: string,
  options: Partial<SourceTrace> = {},
): SourceTrace => ({
  type: "source_trace",
  source_trace_id: id,
  connected_source_port_ids: [],
  connected_source_net_ids: [],
  ...options,
})
const wire = (
  x: number,
  y: number,
  layer: LayerRef = "top",
): PcbTraceRoutePoint => ({
  route_type: "wire",
  x,
  y,
  layer,
  width: 0.1,
})
const trace = (
  id: string,
  route: PcbTraceRoutePoint[],
  pcbId = `pcb_${id}`,
): PcbTrace => ({
  type: "pcb_trace",
  pcb_trace_id: pcbId,
  source_trace_id: id,
  route,
})
const fixture = (
  a = [wire(0, 0), wire(10, 0)],
  b = [wire(2, 0.2), wire(8, 0.2)],
  options: Partial<SourceTrace> = {},
): AnyCircuitElement[] => [
  source("a", {
    coupled_source_trace_id: "b",
    max_coupling_distance: 0.2,
    max_uncoupled_length: 3,
    subcircuit_id: "board",
    ...options,
  }),
  source("b"),
  trace("a", a),
  trace("b", b),
]
const actual = (elements: AnyCircuitElement[]) =>
  checkPcbTraceUncoupledLength(elements)[0]?.actual_uncoupled_length

test("sums both uncoupled ends and includes stable IDs and measured values", () => {
  expect(checkPcbTraceUncoupledLength(fixture())).toMatchObject([
    {
      type: "pcb_trace_uncoupled_length_error",
      pcb_trace_uncoupled_length_error_id: "pcb_trace_uncoupled_length_error_a",
      source_trace_id: "a",
      coupled_source_trace_id: "b",
      pcb_trace_ids: ["pcb_a"],
      actual_uncoupled_length: 4,
      maximum_uncoupled_length: 3,
      subcircuit_id: "board",
    },
  ])
})
test("inclusive length and distance limits, including a zero allowance", () => {
  expect(
    checkPcbTraceUncoupledLength(
      fixture(undefined, undefined, { max_uncoupled_length: 4 }),
    ),
  ).toEqual([])
  expect(
    checkPcbTraceUncoupledLength(
      fixture(undefined, [wire(0, 0.2), wire(10, 0.2)], {
        max_uncoupled_length: 0,
      }),
    ),
  ).toEqual([])
  expect(actual(fixture(undefined, [wire(0, 0.2001), wire(10, 0.2001)]))).toBe(
    10,
  )
})
test("reverse direction and rotated diagonal routes preserve overlap length", () => {
  expect(actual(fixture(undefined, [wire(8, 0.2), wire(2, 0.2)]))).toBe(4)
  const c = Math.SQRT1_2
  const rotated = (x: number, y: number) => wire((x - y) * c, (x + y) * c)
  expect(
    actual(
      fixture(
        [rotated(0, 0), rotated(10, 0)],
        [rotated(2, 0.2), rotated(8, 0.2)],
      ),
    ),
  ).toBeCloseTo(4)
})
test("crossings, nonparallel fanout, different layers, and end proximity do not couple", () => {
  for (const b of [
    [wire(5, -5), wire(5, 5)],
    [wire(0, 0.1), wire(10, 0.19)],
    [wire(0, 0.2, "bottom"), wire(10, 0.2, "bottom")],
    [wire(10.01, 0.1), wire(20, 0.1)],
  ])
    expect(actual(fixture(undefined, b))).toBe(10)
})
test("partner intervals are unioned across overlaps and fragments", () => {
  const data = fixture(undefined, [wire(1, 0.2), wire(6, 0.2)], {
    max_uncoupled_length: 1,
  })
  data.push(trace("b", [wire(4, 0.2), wire(9, 0.2)], "pcb_b2"))
  data.push(trace("b", [wire(2, 0.2), wire(5, 0.2)], "pcb_b3"))
  expect(actual(data)).toBeCloseTo(2)
})
test("sums constrained route fragments without bridging disconnected endpoints", () => {
  const data = fixture([wire(0, 0), wire(5, 0)], [wire(2, 0.2), wire(8, 0.2)])
  data.push(trace("a", [wire(6, 0), wire(10, 0)], "pcb_a2"))
  expect(actual(data)).toBe(4)
  expect(checkPcbTraceUncoupledLength(data)[0]!.pcb_trace_ids).toEqual([
    "pcb_a",
    "pcb_a2",
  ])
})
test("layer changes use both via-adjacent planar segments without adding barrel depth", () => {
  const route = (y: number): PcbTraceRoutePoint[] => [
    wire(0, y),
    { route_type: "via", x: 5, y, from_layer: "top", to_layer: "bottom" },
    wire(10, y, "bottom"),
  ]
  expect(
    checkPcbTraceUncoupledLength(
      fixture(route(0), route(0.2), { max_uncoupled_length: 0 }),
    ),
  ).toEqual([])
  expect(actual(fixture(route(0), [wire(0, 0.2), wire(10, 0.2)]))).toBe(5)
})
test("through-pad travel is uncoupled but incoming and outgoing wires can couple", () => {
  const route: PcbTraceRoutePoint[] = [
    wire(0, 0),
    {
      route_type: "through_pad",
      start: { x: 4, y: 0 },
      end: { x: 6, y: 0 },
      width: 1,
      start_layer: "top",
      end_layer: "top",
    },
    wire(10, 0),
  ]
  expect(
    actual(
      fixture(route, [wire(0, 0.2), wire(10, 0.2)], {
        max_uncoupled_length: 1,
      }),
    ),
  ).toBe(2)
})
test("through-pad partner travel cannot establish coupling", () => {
  const b: PcbTraceRoutePoint[] = [
    {
      route_type: "through_pad",
      start: { x: 0, y: 0.2 },
      end: { x: 10, y: 0.2 },
      width: 1,
      start_layer: "top",
      end_layer: "top",
    },
  ]
  expect(actual(fixture(undefined, b))).toBe(10)
})
test("ignores cached total length and repeated zero-length points", () => {
  const data = fixture([wire(0, 0), wire(0, 0), wire(10, 0)])
  ;(data[2] as PcbTrace).trace_length = 999
  expect(actual(data)).toBe(4)
})
test("unconfigured, incomplete, invalid, self, and missing partner constraints are skipped", () => {
  for (const options of [
    { max_uncoupled_length: undefined },
    { max_coupling_distance: undefined },
    { coupled_source_trace_id: undefined },
    { coupled_source_trace_id: "a" },
    { coupled_source_trace_id: "missing" },
    { max_uncoupled_length: NaN },
    { max_uncoupled_length: -1 },
    { max_coupling_distance: Infinity },
  ])
    expect(
      checkPcbTraceUncoupledLength(fixture(undefined, undefined, options)),
    ).toEqual([])
})
test("unrouted and single-point routes are left to connectivity checks", () => {
  for (const route of [[], [wire(0, 0)]]) {
    expect(checkPcbTraceUncoupledLength(fixture(route))).toEqual([])
    expect(checkPcbTraceUncoupledLength(fixture(undefined, route))).toEqual([])
  }
})
test("each explicitly configured member gets its own measurement", () => {
  const data = fixture()
  Object.assign(data[1]!, {
    coupled_source_trace_id: "a",
    max_coupling_distance: 0.2,
    max_uncoupled_length: 0,
  })
  expect(
    checkPcbTraceUncoupledLength(data).map((e) => e.source_trace_id),
  ).toEqual(["a"])
})
test("unrelated nearby traces cannot satisfy the partner constraint", () => {
  const data = fixture(undefined, [wire(0, 2), wire(10, 2)])
  data.push(source("c"), trace("c", [wire(0, 0.1), wire(10, 0.1)]))
  expect(actual(data)).toBe(10)
})
test("routing runner includes the uncoupled length check", async () => {
  const errors = await runAllRoutingChecks(fixture())
  expect(
    errors.filter((e) => e.type === "pcb_trace_uncoupled_length_error"),
  ).toHaveLength(1)
})
