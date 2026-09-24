import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace, PcbVia } from "circuit-json"
import { createIndexedPcbConnectivityMap } from "../../lib/util/create-indexed-pcb-connectivity-map"
import { getTracePortLayerMismatches } from "../../lib/util/trace-port-layer-connectivity"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { checkEachPcbPortConnectedToPcbTraces } from "../../lib/check-each-pcb-port-connected-to-pcb-trace"

function fixture(): AnyCircuitElement[] {
  return [
    {
      type: "pcb_board",
      pcb_board_id: "board",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      num_layers: 4,
      thickness: 1.6,
      material: "fr4",
    },
    {
      type: "pcb_port",
      pcb_port_id: "p",
      source_port_id: "sp",
      pcb_component_id: "c",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad",
      pcb_port_id: "p",
      pcb_component_id: "c",
      shape: "circle",
      x: 0,
      y: 0,
      radius: 0.2,
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "t",
      route: [
        { route_type: "wire", x: -1, y: 0, layer: "inner2", width: 0.1 },
        {
          route_type: "wire",
          x: 0,
          y: 0,
          layer: "inner2",
          width: 0.1,
          end_pcb_port_id: "p",
        },
      ],
    },
  ]
}
const trace = (c: AnyCircuitElement[]) =>
  c.find((e): e is PcbTrace => e.type === "pcb_trace")!
const via = (overrides: Partial<PcbVia> = {}): PcbVia => ({
  type: "pcb_via",
  pcb_via_id: "v",
  x: 0,
  y: 0,
  hole_diameter: 0.15,
  outer_diameter: 0.3,
  layers: ["top", "inner1", "inner2", "bottom"],
  ...overrides,
})
function expectConnected(c: AnyCircuitElement[]) {
  expect(getTracePortLayerMismatches(c)).toHaveLength(0)
  expect(
    createIndexedPcbConnectivityMap(c)
      .getAllTracesConnectedToPort("p")
      .map((t) => t.pcb_trace_id),
  ).toContain("t")
}
function expectDisconnected(c: AnyCircuitElement[]) {
  expect(getTracePortLayerMismatches(c)).toHaveLength(1)
  expect(
    createIndexedPcbConnectivityMap(c).getAllTracesConnectedToPort("p"),
  ).toHaveLength(0)
}

test("wrong-layer endpoint is rejected even with no source trace", () => {
  const c = fixture()
  expectDisconnected(c)
  expect(checkTracesAreContiguous(c)).toContainEqual(
    expect.objectContaining({
      pcb_trace_id: "t",
      pcb_port_ids: ["p"],
      center: { x: 0, y: 0 },
      message: expect.stringContaining("missing a via"),
    }),
  )
  expect(checkEachPcbPortConnectedToPcbTraces(c)).toContainEqual(
    expect.objectContaining({
      pcb_port_ids: ["p"],
      center: { x: 0, y: 0 },
    }),
  )
})

test("same-layer endpoint remains connected", () => {
  const c = fixture()
  for (const p of trace(c).route) if (p.route_type === "wire") p.layer = "top"
  expectConnected(c)
})

test("standalone via bridges an inner-layer endpoint to a top pad", () => {
  expectConnected([...fixture(), via()])
})

test("via assigned to the same trace is still a physical bridge", () => {
  expectConnected([...fixture(), via({ pcb_trace_id: "t" })])
})

test("buried via cannot bridge to top", () => {
  expectDisconnected([...fixture(), via({ layers: ["inner1", "inner2"] })])
})

test("via reaching top but not the arriving layer cannot bridge", () => {
  expectDisconnected([...fixture(), via({ layers: ["top", "inner1"] })])
})

test("nearby via must actually touch the trace endpoint copper", () => {
  expectConnected([...fixture(), via({ x: 0.19 })])
  expectDisconnected([...fixture(), via({ x: 0.201 })])
})

test("via touching the wire but not the target pad cannot connect it", () => {
  const c = fixture()
  const pad = c.find((e) => e.type === "pcb_smtpad")!
  if (pad.shape !== "circle") throw new Error("Expected circular pad")
  pad.radius = 0.01
  expectDisconnected([...c, via({ x: 0.19 })])
})

test("non-plated hole is not a bridge", () => {
  expectDisconnected([
    ...fixture(),
    {
      type: "pcb_hole",
      pcb_hole_id: "hole",
      hole_shape: "circle",
      x: 0,
      y: 0,
      hole_diameter: 0.3,
    },
  ])
})

test("pad layers override overly broad port metadata", () => {
  const c = fixture()
  const port = c.find((e) => e.type === "pcb_port")!
  port.layers = ["top", "inner2"]
  expectDisconnected(c)
})

test("port-only input still checks declared layers", () => {
  expectDisconnected(fixture().filter((e) => e.type !== "pcb_smtpad"))
})

test("plated hole accepts all of its emitted layers", () => {
  const c = fixture().filter((e) => e.type !== "pcb_smtpad")
  c.push({
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "ph",
    pcb_port_id: "p",
    shape: "circle",
    x: 0,
    y: 0,
    outer_diameter: 0.5,
    hole_diameter: 0.25,
    layers: ["top", "inner1", "inner2", "bottom"],
  })
  expectConnected(c)
})

test("route-only via expands its barrel through intermediate board layers", () => {
  const c = fixture()
  c.push({
    type: "pcb_trace",
    pcb_trace_id: "bridge",
    route: [
      { route_type: "via", x: 0, y: 0, from_layer: "bottom", to_layer: "top" },
    ],
  })
  expectConnected(c)
  // A materialized buried via must override the route's through-via claim.
  expectDisconnected([...c, via({ layers: ["inner1", "inner2"] })])
})

test("route-only via without diameter certifies exact center contact only", () => {
  const c = fixture()
  c.push({
    type: "pcb_trace",
    pcb_trace_id: "bridge",
    route: [
      {
        route_type: "via",
        x: 0.05,
        y: 0,
        from_layer: "inner2",
        to_layer: "top",
      },
    ],
  })
  expectDisconnected(c)
})

test("start endpoints are validated and duplicate port references are deduplicated", () => {
  const c = fixture()
  trace(c).route.reverse()
  const point = trace(c).route[0]
  if (point.route_type !== "wire") throw new Error("Expected wire")
  point.start_pcb_port_id = "p"
  expectDisconnected(c)
})

test("a valid second trace on the same pad does not excuse the invalid attachment", () => {
  const c = fixture()
  c.push({
    type: "pcb_trace",
    pcb_trace_id: "valid",
    route: [
      {
        route_type: "wire",
        x: 0,
        y: 0,
        width: 0.1,
        layer: "top",
        start_pcb_port_id: "p",
      },
      { route_type: "wire", x: 1, y: 0, width: 0.1, layer: "top" },
    ],
  })
  expect(getTracePortLayerMismatches(c)).toHaveLength(1)
  expect(
    createIndexedPcbConnectivityMap(c)
      .getAllTracesConnectedToPort("p")
      .map((t) => t.pcb_trace_id),
  ).toEqual(["valid"])
})
