import { expect, test } from "bun:test"
import type { AnyCircuitElement, SourceBus, PcbTrace } from "circuit-json"
import { checkPcbRoutingConstraints } from "../../lib/check-pcb-routing-constraints"
import { checkPcbBusLengthSkew } from "../../lib/check-pcb-bus-length-skew"
import { capsuleIntervals } from "../../lib/util/check-route-spacing"
import { measureRoute } from "../../lib/util/measure-route"

function fixture() {
  const circuit: AnyCircuitElement[] = []
  const add = (name: string, y: number, length = 20, width = 0.1) => {
    const id = `trace_${name}`
    circuit.push({
      type: "source_trace",
      source_trace_id: id,
      name,
      connected_source_port_ids: [`${id}_a`, `${id}_b`],
      connected_source_net_ids: [],
    })
    for (const [port, x] of [
      [`${id}_a`, 0],
      [`${id}_b`, 20],
    ] as const)
      circuit.push({
        type: "pcb_port",
        pcb_port_id: `pcb_${port}`,
        source_port_id: port,
        x,
        y,
        layers: ["inner1"],
      })
    const points =
      length === 20
        ? [
            [0, y],
            [20, y],
          ]
        : [
            [0, y],
            [0, y + (length - 20) / 2],
            [20, y + (length - 20) / 2],
            [20, y],
          ]
    const trace: PcbTrace = {
      type: "pcb_trace",
      pcb_trace_id: `pcb_${id}`,
      source_trace_id: id,
      trace_length: 9999,
      route: points.map(([x, y]) => ({
        route_type: "wire",
        x: x!,
        y: y!,
        width,
        layer: "inner1",
      })),
    }
    circuit.push(trace)
    return { id, trace }
  }
  const a = add("DATA0", 0),
    b = add("DATA1", 1),
    strobe = add("STROBE", 10)
  const bus: SourceBus = {
    type: "source_bus",
    source_bus_id: "bus_data",
    name: "DATA",
    source_trace_ids: [a.id, b.id],
    length_match_source_trace_ids: [strobe.id],
    max_length_skew: 0.635,
    max_length: { reference: "longest_manhattan" },
  }
  circuit.push(bus)
  return { circuit, add, a, b, strobe, bus }
}
const violations = (circuit: AnyCircuitElement[]) =>
  checkPcbRoutingConstraints(circuit).filter(
    (e) => e.type === "pcb_trace_error",
  )

test("matching adds strobe lengths without altering bus electrical membership", () => {
  const { circuit, bus, a, b, strobe } = fixture()
  strobe.trace.route.splice(
    1,
    0,
    { route_type: "wire", x: 0, y: 11, layer: "inner1", width: 0.1 },
    { route_type: "wire", x: 20, y: 11, layer: "inner1", width: 0.1 },
  )
  expect(violations(circuit).map((e) => e.routing_rule)).toContain(
    "length_skew",
  )
  expect(bus.source_trace_ids).toEqual([a.id, b.id])
  expect(checkPcbBusLengthSkew(circuit)).toEqual([]) // No duplicate legacy diagnostic.
})
test("absolute and relative lengths use copper geometry instead of cached lengths", () => {
  const { circuit, bus, a } = fixture()
  expect(violations(circuit)).toEqual([])
  bus.max_length = 19
  expect(
    violations(circuit).filter((e) => e.routing_rule === "max_length"),
  ).toHaveLength(2)
  bus.max_length = { reference: "longest_manhattan", offset: -1 }
  expect(
    violations(circuit).find((e) => e.source_trace_id === a.id)?.expected_max,
  ).toBe(19)
})
test("explicit Manhattan references and target tolerance apply independently of skew", () => {
  const { circuit, bus, add } = fixture()
  const reference = add("CLOCK", 15)
  const port = circuit.find(
    (e) => e.type === "pcb_port" && e.source_port_id === `${reference.id}_b`,
  )!
  if (port.type === "pcb_port") port.x = 25
  const end = reference.trace.route.at(-1)!
  if (end.route_type === "wire") end.x = 25
  bus.max_length = undefined
  bus.target_length = {
    reference: "longest_manhattan",
    source_trace_ids: [reference.id],
    offset: 2,
  }
  bus.length_tolerance = 1
  const errors = violations(circuit).filter(
    (e) => e.routing_rule === "target_length",
  )
  expect(errors).toHaveLength(2)
  expect(errors[0]!.expected_min).toBe(26)
  expect(errors[0]!.expected_max).toBe(28)
})
test("missing or disconnected geometry is unverified, never zero length", () => {
  const { circuit, a, bus } = fixture()
  circuit.splice(circuit.indexOf(a.trace), 1)
  bus.pcb_spacing_to_other_signals = { width_multiplier: 4 }
  const warnings = checkPcbRoutingConstraints(circuit).filter(
    (e) => e.type === "pcb_trace_warning",
  )
  expect(
    warnings.some(
      (e) =>
        e.routing_rule === "route_geometry" &&
        e.source_trace_id === a.id &&
        e.pcb_trace_id === undefined,
    ),
  ).toBe(true)
  expect(violations(circuit)).toEqual([])
})
test("an unresolved explicit reference warns without suppressing independent rules", () => {
  const { circuit, bus } = fixture()
  bus.min_length = 21
  bus.max_length = {
    reference: "longest_manhattan",
    source_trace_ids: ["missing_reference"],
  }
  expect(
    checkPcbRoutingConstraints(circuit).some(
      (e) =>
        e.type === "pcb_trace_warning" &&
        e.routing_rule === "reference_geometry",
    ),
  ).toBe(true)
  expect(
    violations(circuit).filter((e) => e.routing_rule === "min_length"),
  ).toHaveLength(2)
})
test("external spacing includes partial, unrelated copper without a declared bus", () => {
  const { circuit, bus, add } = fixture()
  const other = add("UNRELATED", 0.25)
  const start = other.trace.route[0]!
  if (start.route_type === "wire") start.x = 5 // It is incomplete but still an obstacle.
  bus.pcb_spacing_to_other_signals = { width_multiplier: 4 }
  expect(
    violations(circuit).some(
      (e) => e.routing_rule === "pcb_spacing_to_other_signals",
    ),
  ).toBe(true)
})
test("centerline spacing uses the larger local width and includes equality", () => {
  const { circuit, bus, b } = fixture()
  bus.pcb_trace_spacing = { width_multiplier: 3 }
  b.trace.route.forEach((p) => {
    if (p.route_type === "wire") {
      p.y = 0.6
      p.width = 0.2
    }
  })
  circuit.forEach((p) => {
    if (p.type === "pcb_port" && p.source_port_id?.startsWith(b.id)) p.y = 0.6
  })
  expect(violations(circuit)).toEqual([])
  b.trace.route.forEach((p) => {
    if (p.route_type === "wire") p.y = 0.59
  })
  circuit.forEach((p) => {
    if (p.type === "pcb_port" && p.source_port_id?.startsWith(b.id)) p.y = 0.59
  })
  expect(
    violations(circuit).filter((e) => e.routing_rule === "pcb_trace_spacing"),
  ).toHaveLength(2)
})
test("pair partners are excluded from internal and external bus spacing", () => {
  const { circuit, bus, a, b } = fixture()
  bus.pcb_trace_spacing = 2
  bus.pcb_spacing_to_other_signals = 2
  circuit.push({
    type: "source_bus",
    source_bus_id: "pair",
    source_trace_ids: [a.id, b.id],
    differential_pair: {
      positive_source_trace_id: a.id,
      negative_source_trace_id: b.id,
      trace_gap: 0.12,
    },
  })
  expect(violations(circuit)).toEqual([])
  bus.source_trace_ids = [a.id] // The partner remains excluded outside the bus too.
  expect(violations(circuit)).toEqual([])
})
test("different layers and same-net fragments do not violate signal spacing", () => {
  const { circuit, bus, add, a } = fixture()
  const other = add("OTHER_LAYER", 0)
  other.trace.route.forEach((p) => {
    if (p.route_type === "wire") p.layer = "inner2"
  })
  const same = add("SAME_NET", 0.1)
  for (const e of circuit)
    if (
      e.type === "source_trace" &&
      [a.id, same.id].includes(e.source_trace_id)
    )
      e.connected_source_net_ids = ["net_shared"]
  bus.pcb_spacing_to_other_signals = 0.4
  expect(violations(circuit)).toEqual([])
})
test("impedance bounds check intent while physical impedance remains unverified", () => {
  const { circuit, bus } = fixture()
  bus.target_impedance = 50
  bus.target_impedance_min = 25
  bus.target_impedance_max = 75
  expect(violations(circuit)).toEqual([])
  expect(
    checkPcbRoutingConstraints(circuit).some(
      (e) =>
        e.type === "pcb_trace_warning" &&
        e.routing_rule === "physical_impedance",
    ),
  ).toBe(true)
  bus.target_impedance = 80
  expect(
    violations(circuit).find((e) => e.routing_rule === "impedance_target")
      ?.actual_value,
  ).toBe(80)
})
test("named and unnamed diagnostics never expose reference IDs", () => {
  const { circuit, bus } = fixture()
  bus.min_length = 25
  expect(violations(circuit)[0]!.message).toContain("DATA")
  bus.name = undefined
  for (const e of violations(circuit)) {
    expect(e.message).not.toContain(bus.source_bus_id)
    expect(e.message).not.toContain(e.source_trace_id)
  }
})
test("capsule intervals detect a brief diagonal crossing without sampling", () => {
  const a = {
    a: { x: 0, y: 0 },
    b: { x: 100, y: 0 },
    width: 0.1,
    layer: "inner1",
  }
  const b = {
    a: { x: 50, y: -1 },
    b: { x: 50, y: 1 },
    width: 0.1,
    layer: "inner1",
  }
  expect(capsuleIntervals(a, b, 0.01).length).toBeGreaterThan(0)
})
test("branched routes cannot be used as trustworthy timing measurements", () => {
  const { circuit, a } = fixture()
  const source = circuit.find(
    (e) => e.type === "source_trace" && e.source_trace_id === a.id,
  )!
  if (source.type !== "source_trace") throw new Error("fixture source missing")
  const branch: PcbTrace = {
    ...a.trace,
    pcb_trace_id: "branch",
    route: [
      { route_type: "wire", x: 0, y: 0, width: 0.1, layer: "inner1" },
      { route_type: "wire", x: 0, y: 2, width: 0.1, layer: "inner1" },
    ],
  }
  expect(measureRoute(source, [a.trace, branch], circuit)).toBeUndefined()
})
