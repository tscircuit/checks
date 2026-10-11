import { expect, test } from "bun:test"
import type { AnyCircuitElement, LayerRef, SourceTrace } from "circuit-json"
import {
  analyzePcbTraceLengths,
  checkPcbTraceLengths,
} from "../../lib/check-pcb-trace-lengths"

const port = (
  id: string,
  x: number,
  y = 0,
  layer: LayerRef = "top",
): AnyCircuitElement => ({
  type: "pcb_port",
  pcb_port_id: `pcb_${id}`,
  source_port_id: id,
  pcb_component_id: `component_${id}`,
  x,
  y,
  layers: [layer],
})
const wire = (x: number, y: number, layer: LayerRef = "top") => ({
  route_type: "wire" as const,
  x,
  y,
  layer,
  width: 0.1,
})
const source = (maximum = 5): SourceTrace => ({
  type: "source_trace",
  source_trace_id: "s",
  name: "LOCAL_CONNECTION",
  connected_source_port_ids: ["a", "b"],
  connected_source_net_ids: [],
  max_length: maximum,
  max_length_origin: "explicit",
})
const route = (
  id: string,
  points: ReturnType<typeof wire>[],
): AnyCircuitElement => ({
  type: "pcb_trace",
  pcb_trace_id: id,
  source_trace_id: "s",
  route: points,
})

test("a genuine local decoupling violation includes measured via depth, role, pin and origin", () => {
  const c: AnyCircuitElement[] = [
    {
      ...source(),
      max_length_origin: "inferred_decoupling",
      capacitor_connection: {
        capacitor_source_component_id: "c1",
        capacitor_source_port_id: "a",
        associated_source_component_id: "u1",
        associated_source_port_id: "b",
        capacitor_role: "decoupling",
        connection_type: "supply",
      },
    },
    {
      type: "source_component",
      source_component_id: "c1",
      ftype: "simple_capacitor",
      name: "C1",
      capacitance: 1e-7,
    },
    {
      type: "source_component",
      source_component_id: "u1",
      ftype: "simple_chip",
      name: "U1",
    },
    {
      type: "source_port",
      source_port_id: "a",
      source_component_id: "c1",
      name: "pin1",
    },
    {
      type: "source_port",
      source_port_id: "b",
      source_component_id: "u1",
      name: "VDD",
      requires_power: true,
    },
    {
      type: "pcb_board",
      pcb_board_id: "board",
      center: { x: 0, y: 0 },
      thickness: 1.2,
      num_layers: 2,
      material: "fr4",
    },
    port("a", 0),
    port("b", 7, 0, "bottom"),
    {
      type: "pcb_trace",
      pcb_trace_id: "local",
      source_trace_id: "s",
      trace_length: 1000,
      route: [
        wire(0, 0),
        wire(2, 0),
        {
          route_type: "via",
          x: 2,
          y: 0,
          from_layer: "top",
          to_layer: "bottom",
        },
        wire(2, 0, "bottom"),
        wire(7, 0, "bottom"),
      ],
    },
    {
      type: "pcb_via",
      pcb_via_id: "barrel",
      x: 2,
      y: 0,
      layers: ["top", "bottom"],
      outer_diameter: 0.5,
      hole_diameter: 0.2,
    },
  ]
  const original = JSON.stringify(c)
  const [finding] = checkPcbTraceLengths(c)
  expect(finding).toMatchObject({
    type: "pcb_trace_too_long_error",
    actual_trace_length: 8.2,
    maximum_trace_length: 5,
    max_length_origin: "inferred_decoupling",
    path_pcb_via_ids: ["barrel"],
    path_pcb_trace_ids: ["local"],
  })
  expect(finding!.message).toContain(
    "C1 (decoupling capacitor, supply to U1.VDD)",
  )
  expect(finding!.message).toContain("automatic decoupling policy")
  expect(finding!.message).not.toContain("u1")
  expect(JSON.stringify(c)).toBe(original)
  const unnamed = c.map((e) =>
    e.type === "source_component" ||
    e.type === "source_port" ||
    e.type === "source_trace"
      ? { ...e, name: "" }
      : e,
  )
  const [unnamedFinding] = checkPcbTraceLengths(unnamed)
  expect(unnamedFinding!.message).toContain("unnamed component.unnamed pin")
  expect(unnamedFinding!.message).not.toContain("c1")
  expect(unnamedFinding!.message).not.toContain("u1")
})

test("72 shared-ground branches do not contribute to the local path length", () => {
  const c: AnyCircuitElement[] = [
    source(3),
    port("a", 0),
    port("b", 2),
    route("local", [wire(0, 0), wire(2, 0)]),
    ...Array.from({ length: 72 }, (_, i) =>
      route(`ground_${i}`, [wire(1, 0), wire(1, 10 + i)]),
    ),
  ]
  expect(checkPcbTraceLengths(c)).toEqual([])
  const [finding] = analyzePcbTraceLengths(c)
  expect(finding!.measurement).toMatchObject({
    status: "measured",
    length: 2,
    pcbTraceIds: ["local"],
  })
  const longer = c.map((e) =>
    e.type === "source_trace" ? { ...e, max_length: 1 } : e,
  )
  expect(checkPcbTraceLengths(longer)[0]).toMatchObject({
    type: "pcb_trace_too_long_error",
    actual_trace_length: 2,
  })
})

test("split routes join at physical T junctions rather than summing branch totals", () => {
  const c: AnyCircuitElement[] = [
    source(8),
    port("a", 0),
    port("b", 5, 4),
    route("bus", [wire(0, 0), wire(10, 0)]),
    route("stub", [wire(5, 0), wire(5, 4)]),
    route("unrelated", [wire(5, 0), wire(5, -30)]),
  ]
  expect(checkPcbTraceLengths(c)[0]).toMatchObject({
    actual_trace_length: 9,
    path_pcb_trace_ids: ["bus", "stub"],
  })
})

test("separate via copper and off-centre SMT pad copper join physical fragments", () => {
  const c: AnyCircuitElement[] = [
    source(6),
    port("a", 0),
    port("b", 7, 0, "bottom"),
    {
      type: "pcb_board",
      pcb_board_id: "board",
      center: { x: 0, y: 0 },
      thickness: 1,
      num_layers: 2,
      material: "fr4",
    },
    route("top", [wire(0, 0), wire(2, 0)]),
    route("bottom", [wire(2, 0, "bottom"), wire(6.8, 0, "bottom")]),
    {
      type: "pcb_via",
      pcb_via_id: "via",
      x: 2,
      y: 0,
      layers: ["top", "bottom"],
      outer_diameter: 0.5,
      hole_diameter: 0.2,
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad",
      pcb_component_id: "component_b",
      pcb_port_id: "pcb_b",
      shape: "rect",
      x: 7,
      y: 0,
      width: 1,
      height: 1,
      layer: "bottom",
    },
  ]
  expect(checkPcbTraceLengths(c)[0]).toMatchObject({
    actual_trace_length: 8,
    path_pcb_via_ids: ["via"],
    path_pcb_trace_ids: ["top", "bottom"],
  })
})

test("a layer crossing without a barrel is indeterminate, never a connected path", () => {
  const c = [
    source(),
    port("a", 0),
    port("b", 5, 4, "bottom"),
    route("top", [wire(0, 0), wire(10, 0)]),
    route("bottom", [wire(5, 0, "bottom"), wire(5, 4, "bottom")]),
  ]
  expect(checkPcbTraceLengths(c)[0]).toMatchObject({
    type: "pcb_trace_warning",
    trace_length_status: "indeterminate",
  })
  expect(checkPcbTraceLengths(c)[0]).not.toHaveProperty("actual_trace_length")
})

test("unknown inner-layer depth is reported rather than guessed", () => {
  const c: AnyCircuitElement[] = [
    source(),
    port("a", 0),
    port("b", 7, 0, "inner1"),
    {
      type: "pcb_trace",
      pcb_trace_id: "trace",
      source_trace_id: "s",
      route: [
        wire(0, 0),
        {
          route_type: "via",
          x: 2,
          y: 0,
          from_layer: "top",
          to_layer: "inner1",
        },
        wire(7, 0, "inner1"),
      ],
    },
  ]
  expect(checkPcbTraceLengths(c)[0]).toMatchObject({
    trace_length_status: "indeterminate",
    measurement_reason:
      "Via or plated-pad depth is unavailable for this layer span",
  })
})

test("declared plane returns are indeterminate and do not aggregate ground branches", () => {
  const c: AnyCircuitElement[] = [
    {
      ...source(),
      connected_source_port_ids: ["a"],
      connected_source_net_ids: ["ground"],
    },
    port("a", 0),
    route("ground", [wire(0, 0), wire(100, 0)]),
    {
      type: "source_pcb_ground_plane",
      source_pcb_ground_plane_id: "plane",
      source_group_id: "group",
      source_net_id: "ground",
    },
  ]
  const [finding] = checkPcbTraceLengths(c)
  expect(finding).toMatchObject({
    type: "pcb_trace_warning",
    trace_length_status: "indeterminate",
    max_length_origin: "explicit",
    maximum_trace_length: 5,
  })
  expect(finding).not.toHaveProperty("actual_trace_length")
  expect(finding!.message).toContain("Plane return")
})

test("a plane-only connection reports uncertainty without a fabricated trace record", () => {
  const c: AnyCircuitElement[] = [
    {
      ...source(),
      connected_source_port_ids: ["a"],
      connected_source_net_ids: ["ground"],
    },
    port("a", 0),
    {
      type: "source_pcb_ground_plane",
      source_pcb_ground_plane_id: "plane",
      source_group_id: "group",
      source_net_id: "ground",
    },
  ]
  const [finding] = checkPcbTraceLengths(c)
  expect(finding).toMatchObject({
    type: "pcb_trace_length_warning",
    trace_length_status: "indeterminate",
    maximum_trace_length: 5,
    source_trace_id: "s",
    pcb_port_ids: ["pcb_a"],
  })
  expect(finding).not.toHaveProperty("pcb_trace_id")
  expect(finding).not.toHaveProperty("actual_trace_length")
})

test("connected pours leave return length indeterminate; a disconnected island does not join traces", () => {
  const c: AnyCircuitElement[] = [
    {
      ...source(),
      max_length_origin: undefined,
      connected_source_net_ids: ["ground"],
    },
    port("a", 0),
    port("b", 10),
    route("local", [wire(0, 0), wire(10, 0)]),
    {
      type: "pcb_copper_pour",
      pcb_copper_pour_id: "pour",
      source_net_id: "ground",
      layer: "top",
      shape: "rect",
      center: { x: 5, y: 0 },
      width: 12,
      height: 2,
      covered_with_solder_mask: true,
    },
  ]
  expect(checkPcbTraceLengths(c)[0]).toMatchObject({
    type: "pcb_trace_warning",
    trace_length_status: "indeterminate",
  })
  const disconnected = c.map((e) =>
    e.type === "pcb_copper_pour" ? { ...e, center: { x: 5, y: 20 } } : e,
  )
  expect(checkPcbTraceLengths(disconnected)[0]).toMatchObject({
    type: "pcb_trace_too_long_error",
    actual_trace_length: 10,
  })
})

test("non-decoupling connections with explicit maxLength remain enforceable", () => {
  const c = [
    source(),
    port("a", 0),
    port("b", 8),
    route("signal", [wire(0, 0), wire(8, 0)]),
  ]
  expect(checkPcbTraceLengths(c)[0]).toMatchObject({
    type: "pcb_trace_too_long_error",
    max_length_origin: "explicit",
    actual_trace_length: 8,
    maximum_trace_length: 5,
  })
  expect(checkPcbTraceLengths(c)[0]!.message).toContain(
    "authored trace maxLength",
  )
})

test("inferred capacitor constraints without an IC association require review", () => {
  const c: AnyCircuitElement[] = [
    { ...source(), max_length_origin: "inferred_decoupling" },
    port("a", 0),
    port("b", 8),
    route("bridge", [wire(0, 0), wire(8, 0)]),
  ]
  expect(checkPcbTraceLengths(c)[0]).toMatchObject({
    type: "pcb_trace_warning",
    trace_length_status: "indeterminate",
  })
})
