import { expect, test } from "bun:test"
import type { AnyCircuitElement, SourceBus, PcbTrace } from "circuit-json"
import { checkPcbDdrRouting } from "../../lib/check-pcb-ddr-routing"
import {
  capsuleIntervals,
  checkDdrSpacing,
} from "../../lib/util/check-ddr-spacing"
import { measureDdrRoute } from "../../lib/util/measure-ddr-route"

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
      ddr_routing: {
        profile: "ti_am335x_ddr3",
        interface_name: "Memory",
        signal_class: role,
        topology: "one_x16",
        byte_index: byte,
      },
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
  return { circuit, dq0, dqs0, dq1, dqs1, command, clock }
}
const findings = (circuit: AnyCircuitElement[]) =>
  checkPcbDdrRouting(circuit).filter((e) => e.status === "violation")

test("measurable TI rules pass without claiming physical DDR sign-off or trusting cached lengths", () => {
  const { circuit } = fixture()
  expect(findings(circuit)).toEqual([])
  const result = checkPcbDdrRouting(circuit)
  expect(result.every((e) => e.status === "unverified")).toBe(true)
  expect(result.map((e) => e.rule)).toContain("impedance")
  expect(result.map((e) => e.rule)).toContain("reference_planes")
  expect(result.map((e) => e.rule)).toContain("power_and_termination")
})
test("data bus may include explicitly associated strobes without ambiguous class membership", () => {
  const { circuit, dq0, dqs0 } = fixture()
  dq0.source_trace_ids.push(...dqs0.source_trace_ids)
  expect(findings(circuit)).toEqual([])
  expect(
    checkPcbDdrRouting(circuit).some(
      (e) => e.rule === "ambiguous_membership" || e.rule === "group_membership",
    ),
  ).toBe(false)
})
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
  expect(rules).toContain("data_nominal_length")
  expect(rules).toContain("data_to_strobe_skew")
  expect(rules).not.toContain("dq0_skew")
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
        e.rule === "command_clock_nominal_length" &&
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
    checkPcbDdrRouting(circuit).some(
      (e) => e.rule === "route_geometry" && e.status === "unverified",
    ),
  ).toBe(true)
  expect(findings(circuit).some((e) => e.rule === "dq0_skew")).toBe(false)
})
test("differential polarity, class coverage and unsupported byte roles are required", () => {
  const { circuit, clock, dq1 } = fixture()
  clock.differential_pair = undefined
  dq1.ddr_routing!.byte_index = undefined
  const rules = checkPcbDdrRouting(circuit).map((e) => e.rule)
  expect(rules).toContain("pair_polarity")
  expect(rules).toContain("interface_completeness")
  expect(rules).toContain("group_definition")
})
test("no profile means no new DDR diagnostics; names never fall back to internal IDs", () => {
  const { circuit } = fixture()
  for (const bus of circuit.filter(
    (e): e is SourceBus => e.type === "source_bus",
  ))
    bus.name = undefined
  const errors = checkPcbDdrRouting(circuit)
  expect(
    errors.every(
      (e) => !/(?:pcb|source|subcircuit)_[a-z0-9_]+/.test(e.message),
    ),
  ).toBe(true)
  expect(errors[0]!.message).toContain("unnamed bus")
  for (const bus of circuit.filter(
    (e): e is SourceBus => e.type === "source_bus",
  ))
    bus.ddr_routing = undefined
  expect(checkPcbDdrRouting(circuit)).toEqual([])
})
test("reduced spacing is unioned across neighbours and capped at 1250 mil", () => {
  const bus: SourceBus = {
    type: "source_bus",
    source_bus_id: "source_bus_1",
    source_trace_ids: ["a", "b", "c"],
    ddr_routing: {
      profile: "ti_am335x_ddr3",
      interface_name: "Memory",
      signal_class: "dq",
      topology: "one_x16",
      byte_index: 0,
    },
  }
  const routes = (length: number, gap: number) =>
    new Map(
      ["a", "b", "c"].map((id, i) => [
        id,
        {
          length,
          manhattan: length,
          segments: [
            {
              a: { x: 0, y: i * gap },
              b: { x: length, y: i * gap },
              layer: "inner1",
              width: 0.1,
            },
          ],
        },
      ]),
    )
  const owners = new Map(["a", "b", "c"].map((id) => [id, bus]))
  expect(checkDdrSpacing(routes(20, 0.2), owners)).toEqual([])
  const result = checkDdrSpacing(routes(32, 0.2), owners)
  expect(result).toHaveLength(3)
  expect(
    result.find((e) => e.sourceTraceId === "b")!.reducedLength,
  ).toBeCloseTo(32)
  expect(
    checkDdrSpacing(routes(0.2, 0.09), owners).every((e) => e.belowMinimum),
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
  expect(measureDdrRoute(source, traces, circuit)?.length).toBe(20)
})

test("pair skew and inclusive TI boundaries are evaluated from geometry", () => {
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
  expect(findings(circuit).some((e) => e.rule === "dqs0_skew")).toBe(false)
  changeLength(0.128)
  expect(findings(circuit).some((e) => e.rule === "dqs0_skew")).toBe(true)
})

test("invalid impedance intent and a two-layer board are measurable violations", () => {
  const { circuit, dq0, clock } = fixture()
  dq0.target_impedance = 49
  clock.target_differential_impedance = 152
  const board = circuit.find((e) => e.type === "pcb_board")!
  if (board.type !== "pcb_board") throw Error("missing board")
  board.num_layers = 2
  const rules = findings(circuit).map((e) => e.rule)
  expect(rules.filter((rule) => rule === "impedance_target")).toHaveLength(2)
  expect(rules).toContain("minimum_layer_count")
})

test("two interfaces with the same name stay scoped to their subcircuits", () => {
  const circuit: AnyCircuitElement[] = []
  for (const scope of ["subcircuit_a", "subcircuit_b"]) {
    const fixtureJson = fixture().circuit
    // Prefix identity fields/references while leaving interface names alone.
    const remapped = JSON.parse(
      JSON.stringify(fixtureJson, (_key, value) =>
        typeof value === "string" &&
        /^(source_bus_|source_trace_|source_port_|pcb_trace_|pcb_port_)/.test(
          value,
        )
          ? `${scope}_${value}`
          : value,
      ),
    ) as AnyCircuitElement[]
    for (const element of remapped) {
      if (element.type === "source_bus" || element.type === "pcb_board")
        element.subcircuit_id = scope
    }
    circuit.push(...remapped)
  }
  const errors = checkPcbDdrRouting(circuit)
  expect(
    errors.some(
      (e) =>
        e.rule === "interface_completeness" ||
        e.rule === "ambiguous_membership",
    ),
  ).toBe(false)
  expect(new Set(errors.map((e) => e.pcb_ddr_routing_error_id)).size).toBe(
    errors.length,
  )
})
