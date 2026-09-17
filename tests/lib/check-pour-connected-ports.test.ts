import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbCopperPourBRep,
  PcbPlatedHole,
  PcbSmtPad,
  PcbVia,
  PcbTrace,
} from "circuit-json"
import { checkEachPcbPortConnectedToPcbTraces } from "lib/check-each-pcb-port-connected-to-pcb-trace"
import { checkSourceTracesHavePcbTraces } from "lib/check-source-traces-have-pcb-traces"

// Board-world coordinates in mm: +X right, +Y up. Both plated GND pads are
// inside one bottom BRep, without any pcb_trace records (core issue #3901).
function fixture(secondPadX = 2) {
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
  const pads: PcbPlatedHole[] = [-2, secondPadX].map((x, i) => ({
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

test("accepts a same-net rectangular pour", () => {
  const { circuitJson, pour } = fixture()
  circuitJson.splice(circuitJson.indexOf(pour), 1, {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "pour",
    source_net_id: "gnd",
    layer: "bottom",
    covered_with_solder_mask: true,
    shape: "rect",
    center: { x: 0, y: 0 },
    width: 8,
    height: 6,
    rotation: 0,
  })
  expect(disconnectedPorts(circuitJson)).toEqual([])
})

test("accepts a same-net polygon pour", () => {
  const { circuitJson, pour } = fixture()
  circuitJson.splice(circuitJson.indexOf(pour), 1, {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "pour",
    source_net_id: "gnd",
    layer: "bottom",
    covered_with_solder_mask: true,
    shape: "polygon",
    points: pour.brep_shape.outer_ring.vertices,
  })
  expect(disconnectedPorts(circuitJson)).toEqual([])
})

test("a plated contact outside the fill still fails", () => {
  const { circuitJson } = fixture(6)
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

test("a different-net pour does not satisfy GND", () => {
  const { circuitJson, pour } = fixture()
  circuitJson.push({
    type: "source_net",
    source_net_id: "vcc",
    name: "VCC",
    member_source_group_ids: [],
  })
  pour.source_net_id = "vcc"
  expect(disconnectedPorts(circuitJson)).toEqual(["port0", "port1"])
})

test("an unassigned pour does not satisfy GND", () => {
  const { circuitJson, pour } = fixture()
  delete pour.source_net_id
  expect(disconnectedPorts(circuitJson)).toEqual(["port0", "port1"])
})

function smtFixture() {
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
  const port = circuitJson.find(
    (e) => e.type === "pcb_port" && e.pcb_port_id === "port1",
  )!
  if (port.type === "pcb_port") port.layers = ["top"]
  return circuitJson
}

function groundVia(): PcbVia {
  return {
    type: "pcb_via",
    pcb_via_id: "via",
    source_net_id: "gnd",
    x: 2,
    y: 0,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
  }
}

test("a top SMT pad over bottom copper is disconnected", () => {
  expect(disconnectedPorts(smtFixture())).toContain("port1")
})

test("a same-net through via connects a top SMT pad to the bottom pour", () => {
  const circuitJson = smtFixture()
  circuitJson.push(groundVia())
  expect(disconnectedPorts(circuitJson)).toEqual([])
})

test("a bottom-only via cannot connect a top SMT pad", () => {
  const circuitJson = smtFixture()
  circuitJson.push({ ...groundVia(), layers: ["bottom"] })
  expect(disconnectedPorts(circuitJson)).toContain("port1")
})

test("a different-net through via cannot connect a top SMT pad to GND", () => {
  const circuitJson = smtFixture()
  circuitJson.push(
    {
      type: "source_net",
      source_net_id: "vcc",
      name: "VCC",
      member_source_group_ids: [],
    },
    { ...groundVia(), source_net_id: "vcc" },
  )
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

function portToPortFixture() {
  const result = fixture()
  const sourceTrace = result.circuitJson.find((e) => e.type === "source_trace")!
  sourceTrace.connected_source_port_ids = ["source_port0", "source_port1"]
  sourceTrace.connected_source_net_ids = []
  return result
}

function splitPour(pour: PcbCopperPourBRep): PcbCopperPourBRep {
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
  return secondPour
}

function copperBridge(endX: number): PcbTrace {
  return {
    type: "pcb_trace",
    pcb_trace_id: "bridge",
    source_trace_id: "trace0",
    route: [
      { route_type: "wire", x: -0.75, y: 0, width: 0.2, layer: "bottom" },
      { route_type: "wire", x: endX, y: 0, width: 0.2, layer: "bottom" },
    ],
  }
}

test("port-to-port source traces can connect through one pour", () => {
  const { circuitJson } = portToPortFixture()
  expect(disconnectedPorts(circuitJson)).toEqual([])
  expect(checkSourceTracesHavePcbTraces(circuitJson)).toEqual([])
})

test("port-to-port source traces cannot connect through separate pour islands", () => {
  const { circuitJson, pour } = portToPortFixture()
  circuitJson.push(splitPour(pour))
  expect(checkEachPcbPortConnectedToPcbTraces(circuitJson)).toHaveLength(2)
  expect(checkSourceTracesHavePcbTraces(circuitJson)).toHaveLength(1)
})

test("separate named-net islands remain disconnected", () => {
  const { circuitJson, pour } = fixture()
  circuitJson.push(splitPour(pour))
  expect(disconnectedPorts(circuitJson)).toEqual(["port0", "port1"])
})

test("a continuous copper bridge joins separate named-net islands", () => {
  const { circuitJson, pour } = fixture()
  circuitJson.push(splitPour(pour), copperBridge(0.75))
  expect(disconnectedPorts(circuitJson)).toEqual([])
})

test("a broken copper bridge leaves named-net islands disconnected", () => {
  const { circuitJson, pour } = fixture()
  circuitJson.push(splitPour(pour), copperBridge(0.25))
  expect(disconnectedPorts(circuitJson)).toEqual(["port0", "port1"])
})

test("a small physical gap is not rounded into a copper connection", () => {
  const { circuitJson, pour } = fixture()
  // The endpoint cap reaches x=0.499, leaving a 0.001 mm gap to the right pour.
  circuitJson.push(splitPour(pour), copperBridge(0.399))
  expect(disconnectedPorts(circuitJson)).toEqual(["port0", "port1"])
})

test("pour connectivity does not synthesize tracks or alter the circuit", () => {
  const { circuitJson } = fixture()
  const before = structuredClone(circuitJson)
  expect(disconnectedPorts(circuitJson)).toEqual([])
  expect(checkSourceTracesHavePcbTraces(circuitJson)).toEqual([])
  expect(circuitJson).toEqual(before)
})

function viaPortFixture() {
  const { circuitJson } = fixture()
  const via = { ...groundVia(), x: 0, y: 2 }
  circuitJson.push(via, {
    type: "source_manually_placed_via",
    source_manually_placed_via_id: "source_via",
    source_group_id: "source_group",
    source_net_id: "gnd",
  })
  // A manual via emits separate layer ports plus a pin1 alias.
  for (const name of ["top", "bottom", "pin1"] as const) {
    circuitJson.push(
      {
        type: "source_port",
        source_port_id: `via_source_${name}`,
        source_component_id: "source_via",
        name,
      },
      {
        type: "pcb_port",
        pcb_port_id: `via_port_${name}`,
        source_port_id: `via_source_${name}`,
        x: via.x,
        y: via.y,
        layers: name === "pin1" ? ["top", "bottom"] : [name],
      },
      {
        type: "source_trace",
        source_trace_id: `via_trace_${name}`,
        connected_source_port_ids: [`via_source_${name}`],
        connected_source_net_ids: ["gnd"],
      },
    )
  }
  return { circuitJson, via }
}

test("all manual via layer ports and aliases share the physical pour root", () => {
  const { circuitJson } = viaPortFixture()
  const before = structuredClone(circuitJson)
  expect(disconnectedPorts(circuitJson)).toEqual([])
  expect(circuitJson).toEqual(before)
})

test("a same-net via outside the pour is still a disconnected peer", () => {
  const { circuitJson, via } = viaPortFixture()
  via.x = 6
  for (const port of circuitJson) {
    if (port.type === "pcb_port" && port.pcb_port_id.startsWith("via_port_")) {
      port.x = via.x
    }
  }
  expect(disconnectedPorts(circuitJson)).toEqual([
    "port0",
    "port1",
    "via_port_bottom",
    "via_port_pin1",
    "via_port_top",
  ])
})

test("via ports cannot reach a pour on a layer outside the barrel span", () => {
  const { circuitJson, via } = viaPortFixture()
  via.layers = ["top"]
  expect(disconnectedPorts(circuitJson)).toContain("port0")
  expect(disconnectedPorts(circuitJson)).toContain("via_port_top")
})

test("a via port on an unsupported layer does not inherit the pour root", () => {
  const { circuitJson } = viaPortFixture()
  for (const port of circuitJson) {
    if (port.type === "pcb_port" && port.pcb_port_id === "via_port_top") {
      port.layers = ["inner1"]
    }
  }
  expect(disconnectedPorts(circuitJson)).toContain("via_port_top")
  expect(disconnectedPorts(circuitJson)).toContain("port0")
})

test("via ports cannot inherit copper from a different net at the same position", () => {
  const { circuitJson, via } = viaPortFixture()
  circuitJson.push({
    type: "source_net",
    source_net_id: "vcc",
    name: "VCC",
    member_source_group_ids: [],
  })
  via.source_net_id = "vcc"
  expect(disconnectedPorts(circuitJson)).toContain("via_port_top")
  expect(disconnectedPorts(circuitJson)).toContain("port0")
})

test("via ports displaced from the barrel cannot inherit its pour root", () => {
  const { circuitJson, via } = viaPortFixture()
  via.x += 0.001
  expect(disconnectedPorts(circuitJson)).toContain("via_port_top")
})
