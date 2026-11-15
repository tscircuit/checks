import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbTraceLengths } from "../../lib/check-pcb-trace-lengths"

const makeCircuit = (): AnyCircuitElement[] => [
  {
    type: "source_net",
    source_net_id: "ground",
    name: "GND",
    member_source_group_ids: [],
  },
  {
    type: "source_net",
    source_net_id: "power",
    name: "VCC",
    member_source_group_ids: [],
  },
  {
    type: "source_trace",
    source_trace_id: "drop",
    connected_source_port_ids: ["cap_ground"],
    connected_source_net_ids: ["ground"],
    max_length: 5,
  },
  {
    type: "pcb_port",
    pcb_port_id: "cap_pad",
    source_port_id: "cap_ground",
    pcb_component_id: "cap",
    x: 0,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "local_drop",
    source_trace_id: "drop",
    route: [
      {
        route_type: "wire",
        x: 0,
        y: 0,
        layer: "top",
        width: 0.2,
        start_pcb_port_id: "cap_pad",
      },
      { route_type: "wire", x: 0, y: 0.65, layer: "top", width: 0.2 },
      {
        route_type: "via",
        x: 0,
        y: 0.65,
        from_layer: "top",
        to_layer: "inner1",
      },
    ],
  },
  {
    type: "pcb_via",
    pcb_via_id: "ground_via",
    pcb_trace_id: "local_drop",
    x: 0,
    y: 0.65,
    hole_diameter: 0.2,
    outer_diameter: 0.45,
    layers: ["top", "inner1"],
    from_layer: "top",
    to_layer: "inner1",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "other_branch",
    source_trace_id: "drop",
    route: [
      {
        route_type: "wire",
        x: 0,
        y: 0,
        layer: "top",
        width: 0.2,
        start_pcb_port_id: "cap_pad",
      },
      { route_type: "wire", x: 12, y: 0, layer: "top", width: 0.2 },
    ],
  },
  {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "plane",
    source_net_id: "ground",
    layer: "inner1",
    shape: "brep",
    covered_with_solder_mask: true,
    brep_shape: {
      outer_ring: {
        vertices: [
          { x: -2, y: -2 },
          { x: 2, y: -2 },
          { x: 2, y: 2 },
          { x: -2, y: 2 },
        ],
      },
      inner_rings: [],
    },
  },
]

test("port-to-plane length requires real copper contact and retains genuine violations", () => {
  expect(checkPcbTraceLengths(makeCircuit())).toEqual([])
  const reversed = makeCircuit()
  reversed.filter((e) => e.type === "pcb_trace")[0].route.reverse()
  expect(checkPcbTraceLengths(reversed)).toEqual([])
  const tooShort = makeCircuit()
  tooShort.find((e) => e.type === "source_trace")!.max_length = 2
  expect(checkPcbTraceLengths(tooShort)).toMatchObject([
    {
      pcb_trace_id: "local_drop",
      actual_trace_length: 2.25,
      maximum_trace_length: 2,
    },
  ])
  expect(checkPcbTraceLengths([...tooShort].reverse())).toMatchObject([
    {
      pcb_trace_id: "local_drop",
      actual_trace_length: 2.25,
      maximum_trace_length: 2,
    },
  ])
  const negatives: Array<
    (circuit: AnyCircuitElement[]) => AnyCircuitElement[]
  > = [
    (c) => c.filter((e) => e.type !== "pcb_via"),
    (c) => c.filter((e) => e.type !== "pcb_copper_pour"),
    (c) => {
      c.find((e) => e.type === "pcb_copper_pour")!.source_net_id = "power"
      return c
    },
    (c) => {
      c.find((e) => e.type === "pcb_copper_pour")!.layer = "bottom"
      return c
    },
    (c) => {
      c.find((e) => e.type === "pcb_port")!.x = 10
      return c
    },
    (c) => {
      c.find((e) => e.type === "pcb_via")!.layers = ["top", "bottom"]
      return c
    },
    (c) => {
      const pour = c.find((e) => e.type === "pcb_copper_pour")!
      if (pour.shape === "brep")
        pour.brep_shape.inner_rings.push({
          vertices: [
            { x: -1, y: -1 },
            { x: -1, y: 1.5 },
            { x: 1, y: 1.5 },
            { x: 1, y: -1 },
          ],
        })
      return c
    },
    (c) => {
      const pour = c.find((e) => e.type === "pcb_copper_pour")!
      if (pour.shape === "brep")
        pour.brep_shape.outer_ring.vertices = [
          { x: -0.03, y: 0.62 },
          { x: 0.03, y: 0.62 },
          { x: 0.03, y: 0.68 },
          { x: -0.03, y: 0.68 },
        ]
      return c // Copper entirely inside the drill is not annulus contact.
    },
  ]
  for (const mutate of negatives) {
    expect(checkPcbTraceLengths(mutate(makeCircuit()))).toMatchObject([
      { actual_trace_length: 14.25, maximum_trace_length: 5 },
    ])
  }
})
