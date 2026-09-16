import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbCopperPourBRep,
  PcbPlatedHole,
  PcbSmtPad,
} from "circuit-json"
import { checkEachPcbPortConnectedToPcbTraces } from "lib/check-each-pcb-port-connected-to-pcb-trace"
import { checkSourceTracesHavePcbTraces } from "lib/check-source-traces-have-pcb-traces"

// Board-world coordinates in mm: +X right, +Y up. Both plated GND pads are
// inside one bottom BRep, without any pcb_trace records (core issue #3901).
function fixture() {
  const pour: PcbCopperPourBRep = {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "pour",
    source_net_id: "gnd",
    shape: "brep",
    layer: "bottom",
    covered_with_solder_mask: true,
    brep_shape: {
      outer_ring: {
        vertices: [
          { x: -4, y: -3 },
          { x: 4, y: -3 },
          { x: 4, y: 3 },
          { x: -4, y: 3 },
        ],
      },
      inner_rings: [],
    },
  }
  const pads: PcbPlatedHole[] = [-2, 2].map((x, i) => ({
    type: "pcb_plated_hole",
    pcb_plated_hole_id: `hole${i}`,
    pcb_port_id: `port${i}`,
    pcb_component_id: `pcb${i}`,
    shape: "circle",
    x,
    y: 0,
    layers: ["top", "bottom"],
    hole_diameter: 0.8,
    outer_diameter: 1.4,
  }))
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_net",
      source_net_id: "gnd",
      name: "GND",
      member_source_group_ids: [],
    },
    pour,
    ...pads,
  ]
  for (const [i, pad] of pads.entries()) {
    circuitJson.push(
      {
        type: "source_component",
        source_component_id: `source${i}`,
        name: `J${i + 1}`,
        ftype: "simple_chip",
        supplier_part_numbers: {},
      },
      {
        type: "source_port",
        source_port_id: `source_port${i}`,
        source_component_id: `source${i}`,
        name: "GND",
        pin_number: 1,
      },
      {
        type: "source_trace",
        source_trace_id: `trace${i}`,
        connected_source_port_ids: [`source_port${i}`],
        connected_source_net_ids: ["gnd"],
      },
      {
        type: "pcb_component",
        pcb_component_id: `pcb${i}`,
        source_component_id: `source${i}`,
        center: { x: pad.x, y: 0 },
        width: 1.4,
        height: 1.4,
        rotation: 0,
        layer: "top",
        obstructs_within_bounds: false,
      },
      {
        type: "pcb_port",
        pcb_port_id: `port${i}`,
        source_port_id: `source_port${i}`,
        pcb_component_id: `pcb${i}`,
        x: pad.x,
        y: 0,
        layers: ["top", "bottom"],
      },
    )
  }
  return { circuitJson, pour, pads }
}

const disconnectedPorts = (circuitJson: AnyCircuitElement[]) =>
  checkEachPcbPortConnectedToPcbTraces(circuitJson)
    .flatMap((error) => error.pcb_port_ids)
    .sort()

test("plated GND contacts connected through a bottom pour need no tracks", () => {
  const { circuitJson } = fixture()
  expect(disconnectedPorts(circuitJson)).toEqual([])
})

test.each(["rect", "polygon"] as const)(
  "accepts a same-net %s pour",
  (shape) => {
    const { circuitJson, pour } = fixture()
    circuitJson.splice(circuitJson.indexOf(pour), 1, {
      type: "pcb_copper_pour",
      pcb_copper_pour_id: "pour",
      source_net_id: "gnd",
      layer: "bottom",
      covered_with_solder_mask: true,
      ...(shape === "rect"
        ? { shape, center: { x: 0, y: 0 }, width: 8, height: 6, rotation: 0 }
        : { shape, points: pour.brep_shape.outer_ring.vertices }),
    })
    expect(disconnectedPorts(circuitJson)).toEqual([])
  },
)

test("a plated contact outside the fill still fails", () => {
  const { circuitJson, pads } = fixture()
  pads[1].x = 6
  expect(disconnectedPorts(circuitJson)).toContain("port1")
})

test("a plated contact inside a BRep antipad still fails", () => {
  const { circuitJson, pour } = fixture()
  pour.brep_shape.inner_rings.push({
    vertices: [
      { x: 1, y: -1 },
      { x: 3, y: -1 },
      { x: 3, y: 1 },
      { x: 1, y: 1 },
    ],
  })
  expect(disconnectedPorts(circuitJson)).toContain("port1")
})

test("a circular bulge antipad excludes the entire plated annulus", () => {
  const { circuitJson, pour } = fixture()
  pour.brep_shape.inner_rings.push({
    vertices: [
      { x: 1, y: 0, bulge: 1 },
      { x: 3, y: 0, bulge: 1 },
    ],
  })
  expect(disconnectedPorts(circuitJson)).toContain("port1")
})

test("a different-net or unassigned pour does not satisfy GND", () => {
  const { circuitJson, pour } = fixture()
  circuitJson.push({
    type: "source_net",
    source_net_id: "vcc",
    name: "VCC",
    member_source_group_ids: [],
  })
  pour.source_net_id = "vcc"
  expect(disconnectedPorts(circuitJson)).toEqual(["port0", "port1"])
  delete pour.source_net_id
  expect(disconnectedPorts(circuitJson)).toEqual(["port0", "port1"])
})

test("a top SMT pad requires a physical plated transition to the bottom pour", () => {
  const { circuitJson, pads } = fixture()
  const smt: PcbSmtPad = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "smt",
    pcb_port_id: "port1",
    pcb_component_id: "pcb1",
    shape: "rect",
    x: 2,
    y: 0,
    width: 1.4,
    height: 1.4,
    layer: "top",
  }
  circuitJson.splice(circuitJson.indexOf(pads[1]), 1, smt)
  expect(disconnectedPorts(circuitJson)).toContain("port1")

  const via = {
    type: "pcb_via" as const,
    pcb_via_id: "via",
    source_net_id: "gnd",
    x: 2,
    y: 0,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"] as PcbPlatedHole["layers"],
  }
  circuitJson.push(via)
  expect(disconnectedPorts(circuitJson)).toEqual([])
  via.layers = ["bottom"]
  expect(disconnectedPorts(circuitJson)).toContain("port1")
})

test("pour inside a plated drill hole is not a copper contact", () => {
  const { circuitJson, pour } = fixture()
  pour.brep_shape.outer_ring.vertices = [
    { x: 1.9, y: -0.1 },
    { x: 2.1, y: -0.1 },
    { x: 2.1, y: 0.1 },
    { x: 1.9, y: 0.1 },
  ]
  expect(disconnectedPorts(circuitJson)).toEqual(["port0", "port1"])
})

test("port-to-port source traces may use one pour, but not separate islands", () => {
  const { circuitJson, pour } = fixture()
  const sourceTrace = circuitJson.find((e) => e.type === "source_trace")!
  if (sourceTrace.type !== "source_trace")
    throw new Error("missing source trace")
  sourceTrace.connected_source_port_ids = ["source_port0", "source_port1"]
  sourceTrace.connected_source_net_ids = []
  expect(disconnectedPorts(circuitJson)).toEqual([])
  expect(checkSourceTracesHavePcbTraces(circuitJson)).toEqual([])

  const secondPour = structuredClone(pour)
  secondPour.pcb_copper_pour_id = "second_pour"
  pour.brep_shape.outer_ring.vertices = [
    { x: -4, y: -3 },
    { x: -1, y: -3 },
    { x: -1, y: 3 },
    { x: -4, y: 3 },
  ]
  secondPour.brep_shape.outer_ring.vertices = [
    { x: 1, y: -3 },
    { x: 4, y: -3 },
    { x: 4, y: 3 },
    { x: 1, y: 3 },
  ]
  circuitJson.push(secondPour)
  expect(checkEachPcbPortConnectedToPcbTraces(circuitJson)).toHaveLength(2)
  expect(checkSourceTracesHavePcbTraces(circuitJson)).toHaveLength(1)
})

test("separate named-net islands require a physical copper bridge", () => {
  const { circuitJson, pour } = fixture()
  const secondPour = structuredClone(pour)
  secondPour.pcb_copper_pour_id = "second_pour"
  pour.brep_shape.outer_ring.vertices = [
    { x: -4, y: -3 },
    { x: -0.5, y: -3 },
    { x: -0.5, y: 3 },
    { x: -4, y: 3 },
  ]
  secondPour.brep_shape.outer_ring.vertices = [
    { x: 0.5, y: -3 },
    { x: 4, y: -3 },
    { x: 4, y: 3 },
    { x: 0.5, y: 3 },
  ]
  circuitJson.push(secondPour)
  expect(disconnectedPorts(circuitJson)).toEqual(["port0", "port1"])
  const bridge = {
    type: "pcb_trace" as const,
    pcb_trace_id: "bridge",
    source_trace_id: "trace0",
    route: [
      {
        route_type: "wire" as const,
        x: -0.75,
        y: 0,
        width: 0.2,
        layer: "bottom" as const,
      },
      {
        route_type: "wire" as const,
        x: 0.75,
        y: 0,
        width: 0.2,
        layer: "bottom" as const,
      },
    ],
  }
  circuitJson.push(bridge)
  expect(disconnectedPorts(circuitJson)).toEqual([])
  bridge.route[1].x = 0.25
  expect(disconnectedPorts(circuitJson)).toEqual(["port0", "port1"])
})
