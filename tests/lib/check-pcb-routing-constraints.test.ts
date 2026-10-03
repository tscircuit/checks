import { expect, test } from "bun:test"
import type { AnyCircuitElement, SourceBus, PcbTrace } from "circuit-json"
import { checkPcbRoutingConstraints } from "../../lib/check-pcb-routing-constraints"
import { capsuleIntervals } from "../../lib/util/check-route-spacing"
import { measureRoute } from "../../lib/util/measure-route"
function fixture() {
  const circuit: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "pcb_board_1",
      center: { x: 10, y: 0 },
      width: 100,
      height: 300,
      num_layers: 4,
      thickness: 1.2,
      material: "fr4",
    },
  ]
  let ordinal = 0
  const add = (
    role: "dq" | "dqs" | "ck" | "addr_ctrl",
    count: number,
    y: number,
    byte?: 0 | 1,
  ) => {
    const bus: SourceBus = {
      type: "source_bus",
      source_bus_id: `source_bus_${ordinal++}`,
      name: `Memory ${role}${byte ?? ""}`,
      source_trace_ids: [],
      max_length_skew:
        role === "dqs" || role === "ck"
          ? 0.127
          : role === "dq"
            ? 0.635
            : undefined,
      routing_constraints: { expected_trace_count: count },
    }
    for (let i = 0; i < count; i++) {
      const id = `source_trace_${ordinal++}`,
        start = `source_port_${ordinal++}`,
        end = `source_port_${ordinal++}`
      const Y = y + i * (role === "ck" || role === "dqs" ? 0.2 : 1)
      bus.source_trace_ids.push(id)
      circuit.push({
        type: "source_trace",
        source_trace_id: id,
        connected_source_port_ids: [start, end],
        connected_source_net_ids: [],
      })
      for (const [portId, x] of [
        [start, 0],
        [end, 20],
      ] as const)
        circuit.push({
          type: "pcb_port",
          pcb_port_id: `pcb_port_${portId}`,
          source_port_id: portId,
          x,
          y: Y,
          layers: ["inner1"],
        })
      const points =
        role === "ck" || role === "addr_ctrl"
          ? [
              [0, Y],
              [0, Y + 3.81],
              [20, Y + 3.81],
              [20, Y],
            ]
          : [
              [0, Y],
              [20, Y],
            ]
      circuit.push({
        type: "pcb_trace",
        pcb_trace_id: `pcb_trace_${id}`,
        source_trace_id: id,
        route: points.map(([x, y]) => ({
          route_type: "wire",
          x: x!,
          y: y!,
          layer: "inner1",
          width: 0.1,
        })),
        trace_length: 9999,
      })
    }
    if (role === "ck" || role === "dqs")
      bus.differential_pair = {
        positive_source_trace_id: bus.source_trace_ids[0]!,
        negative_source_trace_id: bus.source_trace_ids[1]!,
      }
    circuit.push(bus)
    return bus
  }
  const dq0 = add("dq", 9, 0, 0),
    dqs0 = add("dqs", 2, 12, 0)
  const dq1 = add("dq", 9, 30, 1),
    dqs1 = add("dqs", 2, 42, 1)
  const command = add("addr_ctrl", 1, 80),
    clock = add("ck", 2, 100)
  for (const [dq, dqs] of [
    [dq0, dqs0],
    [dq1, dqs1],
  ]) {
    const combined: SourceBus = {
      type: "source_bus",
      source_bus_id: `${dq.source_bus_id}_combined`,
      name: `${dq.name} combined`,
      routing_constraints: { expected_trace_count: 11 },
      source_trace_ids: [...dq.source_trace_ids, ...dqs.source_trace_ids],
      max_length_skew: 0.635,
    }
    circuit.push(combined)
    dq.routing_constraints!.length_bounds = {
      reference_bus: combined.name,
      reference_metric: "longest_manhattan",
      max: 0,
    }
  }
  const commandClock: SourceBus = {
    type: "source_bus",
    source_bus_id: "command_clock",
    name: "Command and clock",
    source_trace_ids: [...command.source_trace_ids, ...clock.source_trace_ids],
  }
  circuit.push(commandClock)
  for (const bus of [command, clock])
    bus.routing_constraints!.length_bounds = {
      reference_bus: commandClock.name,
      reference_metric: "longest_manhattan",
      min: 6.35,
      max: 8.89,
    }
  return { circuit, dq0, dqs0, dq1, dqs1, command, clock }
}
const findings = (circuit: AnyCircuitElement[]) =>
  checkPcbRoutingConstraints(circuit).filter((e) => e.status === "violation")
test("absolute byte length and data-to-strobe skew fail independently of equal data lengths", () => {
  const { circuit, dq0 } = fixture()
  for (const trace of circuit.filter(
    (e): e is PcbTrace =>
      e.type === "pcb_trace" &&
      dq0.source_trace_ids.includes(e.source_trace_id!),
  )) {
    const y = trace.route[0]!.route_type === "wire" ? trace.route[0]!.y : 0
    trace.route = [
      [0, y],
      [0, y - 0.5],
      [20, y - 0.5],
      [20, y],
    ].map(([x, y]) => ({
      route_type: "wire",
      x: x!,
      y: y!,
      width: 0.1,
      layer: "inner1",
    }))
  }
  const rules = findings(circuit).map((e) => e.rule)
  expect(rules).toContain("length_bounds")
  expect(rules).toContain("length_skew")
})
test("address/control must follow the clock nominal window even when its own bus has no skew", () => {
  const { circuit, command } = fixture()
  const trace = circuit.find(
    (e): e is PcbTrace =>
      e.type === "pcb_trace" &&
      e.source_trace_id === command.source_trace_ids[0],
  )!
  trace.route = [trace.route[0]!, trace.route.at(-1)!]
  expect(
    findings(circuit).some(
      (e) =>
        e.rule === "length_bounds" &&
        e.source_bus_ids.includes(command.source_bus_id),
    ),
  ).toBe(true)
})
test("missing or disconnected geometry stays unverified instead of becoming zero length", () => {
  const { circuit, dq0 } = fixture()
  const trace = circuit.find(
    (e): e is PcbTrace =>
      e.type === "pcb_trace" && e.source_trace_id === dq0.source_trace_ids[0],
  )!
  trace.route.pop()
  expect(
    checkPcbRoutingConstraints(circuit).some(
      (e) => e.rule === "route_geometry" && e.status === "unverified",
    ),
  ).toBe(true)
})
test("capsule intersections catch short crossings, while other-layer copper is ignored", () => {
  const a = {
    a: { x: 0, y: 0 },
    b: { x: 1, y: 0 },
    layer: "inner1",
    width: 0.1,
  }
  const b = {
    a: { x: 0.5, y: -1 },
    b: { x: 0.5, y: 1 },
    layer: "inner1",
    width: 0.1,
  }
  const intervals = capsuleIntervals(a, b, 0.1)
  expect(intervals[0]![0]).toBeCloseTo(0.4)
  expect(intervals[0]![1]).toBeCloseTo(0.6)
})
test("planar measurement joins fanout fragments through explicit vias without invented barrel depth", () => {
  const { circuit, dq0 } = fixture()
  const source = circuit.find(
    (e) =>
      e.type === "source_trace" &&
      e.source_trace_id === dq0.source_trace_ids[0],
  )!
  if (source.type !== "source_trace") throw Error("missing fixture signal")
  const wire = (x: number, layer: "top" | "inner1") => ({
    route_type: "wire" as const,
    x,
    y: 0,
    width: 0.1,
    layer,
  })
  const traces: PcbTrace[] = [
    {
      type: "pcb_trace",
      pcb_trace_id: "fanout",
      source_trace_id: source.source_trace_id,
      route: [wire(0, "top"), wire(1, "top")],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "carrier",
      source_trace_id: source.source_trace_id,
      route: [wire(1, "inner1"), wire(20, "inner1")],
    },
  ]
  const first = circuit.find(
    (e) =>
      e.type === "pcb_port" &&
      e.source_port_id === source.connected_source_port_ids[0],
  )!
  if (first.type !== "pcb_port") throw Error("missing fixture port")
  first.layers = ["top"]
  circuit.push({
    type: "pcb_via",
    pcb_via_id: "via",
    x: 1,
    y: 0,
    layers: ["top", "inner1"],
    hole_diameter: 0.15,
    outer_diameter: 0.3,
  })
  expect(measureRoute(source, traces, circuit)?.length).toBe(20)
})

test("pair skew and inclusive declared boundaries are evaluated from geometry", () => {
  const { circuit, dqs0 } = fixture()
  const trace = circuit.find(
    (e): e is PcbTrace =>
      e.type === "pcb_trace" && e.source_trace_id === dqs0.source_trace_ids[0],
  )!
  const y = trace.route[0]!.route_type === "wire" ? trace.route[0]!.y : 0
  const changeLength = (extra: number) => {
    trace.route = [
      [0, y],
      [0, y - extra / 2],
      [20, y - extra / 2],
      [20, y],
    ].map(([x, y]) => ({
      route_type: "wire",
      x: x!,
      y: y!,
      width: 0.1,
      layer: "inner1",
    }))
  }
  changeLength(0.127)
  expect(findings(circuit).some((e) => e.rule === "length_skew")).toBe(false)
  changeLength(0.128)
  expect(findings(circuit).some((e) => e.rule === "length_skew")).toBe(true)
})

test("overlapping groups are allowed and rules have no vendor defaults", () => {
  const { circuit, dq0, dqs0 } = fixture()
  expect(checkPcbRoutingConstraints(circuit)).toEqual([])
  dq0.source_trace_ids.push(...dqs0.source_trace_ids)
  expect(findings(circuit).some((e) => e.rule === "member_count")).toBe(true)
  dq0.routing_constraints!.expected_trace_count = 11
  expect(findings(circuit)).toEqual([])
})
test("renaming groups does not change outcomes; unresolved references stay unverified", () => {
  const { circuit, dq0 } = fixture()
  dq0.routing_constraints!.length_bounds!.reference_bus = "missing group"
  const errors = checkPcbRoutingConstraints(circuit)
  expect(
    errors.some((e) => e.rule === "bus_reference" && e.status === "unverified"),
  ).toBe(true)
  for (const bus of circuit.filter(
    (e): e is SourceBus => e.type === "source_bus",
  )) {
    bus.max_length_skew = undefined
    bus.routing_constraints = undefined
  }
  expect(checkPcbRoutingConstraints(circuit)).toEqual([])
})
test("impedance bounds check actual declared targets without converting differential impedance", () => {
  const { circuit, dq0, clock } = fixture()
  dq0.routing_constraints!.impedance_bounds = { min: 50, max: 75 }
  dq0.target_impedance = 49
  clock.routing_constraints!.impedance_bounds = { min: 100, max: 150 }
  clock.target_differential_impedance = 151
  expect(
    findings(circuit).filter((e) => e.rule === "impedance_target"),
  ).toHaveLength(2)
  expect(
    checkPcbRoutingConstraints(circuit).filter(
      (e) => e.rule === "physical_impedance",
    ),
  ).toHaveLength(2)
})
test("unnamed groups never expose internal identifiers in diagnostic messages", () => {
  const { circuit, dq0 } = fixture()
  dq0.name = undefined
  dq0.routing_constraints = { expected_trace_count: 3 }
  const result = checkPcbRoutingConstraints(circuit)
  expect(result[0]!.message).toContain("unnamed bus")
  expect(
    result.every(
      (e) => !/(?:pcb|source|subcircuit)_[a-z0-9_]+/.test(e.message),
    ),
  ).toBe(true)
})
test("spacing interval union and length cap are supplied by the design", () => {
  const { circuit, dq0 } = fixture()
  // Parallel signals are one mm apart, ten widths; declare twelve widths.
  dq0.routing_constraints = {
    spacing: [
      {
        other_bus: dq0.name!,
        centerline_width_multiplier: 12,
        reduced_centerline_width_multiplier: 1,
      },
    ],
    max_reduced_spacing_length: 21,
  }
  expect(findings(circuit)).toEqual([])
  dq0.routing_constraints.max_reduced_spacing_length = 19
  const errors = findings(circuit).filter(
    (e) => e.rule === "reduced_spacing_length",
  )
  expect(errors).toHaveLength(9)
  expect(errors.every((e) => Math.abs(e.actual_value! - 20) < 1e-8)).toBe(true)
  dq0.routing_constraints.max_reduced_spacing_length = undefined
  dq0.routing_constraints.spacing![0] = {
    other_bus: dq0.name!,
    centerline_width_multiplier: 11,
  }
  expect(findings(circuit).some((e) => e.rule === "minimum_spacing")).toBe(true)
})
test("bus references are scoped and cannot silently choose a duplicate name", () => {
  const { circuit, dq0 } = fixture()
  const ref = circuit.find(
    (e): e is SourceBus =>
      e.type === "source_bus" &&
      e.name === dq0.routing_constraints!.length_bounds!.reference_bus,
  )!
  circuit.push({
    ...ref,
    source_bus_id: "other_scope",
    subcircuit_id: "subcircuit_other",
  })
  expect(findings(circuit)).toEqual([])
  circuit.push({ ...ref, source_bus_id: "duplicate" })
  expect(
    checkPcbRoutingConstraints(circuit).some((e) => e.rule === "bus_reference"),
  ).toBe(true)
})
