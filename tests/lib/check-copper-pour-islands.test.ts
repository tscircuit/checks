import { expect, test } from "bun:test"
import {
  pcb_copper_pour_isolated_warning,
  any_circuit_element,
  type AnyCircuitElement,
} from "circuit-json"
import { checkCopperPourIslands, runAllRoutingChecks } from "../../index"
import am3352Island from "../fixtures/am3352-ground-pour-island.json"

const square = (r: number) => [
  { x: -r, y: -r },
  { x: r, y: -r },
  { x: r, y: r },
  { x: -r, y: r },
]
const net = {
  type: "source_net",
  source_net_id: "source_net_ground",
  name: "GND",
  member_source_group_ids: [],
}
const pour = {
  type: "pcb_copper_pour",
  pcb_copper_pour_id: "pcb_copper_pour_island",
  source_net_id: net.source_net_id,
  covered_with_solder_mask: true,
  shape: "brep",
  layer: "top",
  subcircuit_id: "subcircuit_test",
  brep_shape: { outer_ring: { vertices: square(2) }, inner_rings: [] },
}
const via = {
  type: "pcb_via",
  pcb_via_id: "pcb_via_anchor",
  source_net_id: net.source_net_id,
  x: 0,
  y: 0,
  outer_diameter: 0.6,
  hole_diameter: 0.3,
  layers: ["top", "bottom"],
}
const check = (...elements: unknown[]) =>
  checkCopperPourIslands([net, ...elements] as AnyCircuitElement[])

test("reports a net-assigned pour even when the net has no terminals", () => {
  const errors = check(pour)
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_copper_pour_isolated_warning",
    pcb_copper_pour_isolated_warning_id:
      "pcb_copper_pour_isolated_warning_pcb_copper_pour_island",
    warning_type: "pcb_copper_pour_isolated_warning",
    pcb_copper_pour_id: pour.pcb_copper_pour_id,
    source_net_id: net.source_net_id,
    layer: "top",
    center: { x: 0, y: 0 },
    subcircuit_id: "subcircuit_test",
  })
  expect(pcb_copper_pour_isolated_warning.parse(errors[0])).toEqual(errors[0])
  expect(any_circuit_element.parse(errors[0])).toEqual(errors[0])
  expect(errors[0]).not.toHaveProperty("error_type")
  expect(errors[0].message).toContain("GND")
  expect(errors[0].message).toContain("top near (0.00 mm, 0.00 mm)")
  expect(errors[0].message).not.toContain(net.source_net_id)
  expect(errors[0].message).not.toContain(pour.pcb_copper_pour_id)
})

test("messages use a readable fallback for unnamed nets", () => {
  const errors = checkCopperPourIslands([
    { ...net, name: "" },
    pour,
  ] as AnyCircuitElement[])
  expect(errors[0].message).toContain("unnamed net")
  expect(errors[0].message).not.toContain(net.source_net_id)
})

test("unassigned decorative copper and circuits without pours are ignored", () => {
  expect(check({ ...pour, source_net_id: undefined })).toEqual([])
  expect(check(via)).toEqual([])
})

test("a physical same-net via anchors the pour", () => {
  expect(check(pour, via)).toEqual([])
  expect(check(pour, { ...via, x: 4 })).toHaveLength(1)
  expect(check(pour, { ...via, layers: ["bottom"] })).toHaveLength(1)
  expect(
    check(pour, { ...via, source_net_id: "source_net_other" }),
  ).toHaveLength(1)
})

test("one grounded island does not hide a separate island on the same net", () => {
  const island = {
    ...pour,
    pcb_copper_pour_id: "pcb_copper_pour_remote",
    shape: "rect",
    center: { x: 8, y: 0 },
    width: 2,
    height: 2,
  }
  const errors = check(pour, island, via)
  expect(errors.map((e) => e.pcb_copper_pour_isolated_warning_id)).toEqual([
    "pcb_copper_pour_isolated_warning_pcb_copper_pour_remote",
  ])
})

test("touching same-layer pours can reach an anchor transitively", () => {
  const neighbor = {
    ...pour,
    pcb_copper_pour_id: "pcb_copper_pour_neighbor",
    shape: "rect",
    center: { x: 3, y: 0 },
    width: 2,
    height: 2,
  }
  expect(check(pour, neighbor, via)).toEqual([])
  expect(check(pour, neighbor)).toHaveLength(2)
  expect(check(pour, { ...neighbor, layer: "bottom" }, via)).toHaveLength(1)
})

test("a BRep cutout does not connect enclosed via copper", () => {
  for (const vertices of [square(1), square(1).reverse()]) {
    expect(
      check(
        {
          ...pour,
          brep_shape: {
            ...pour.brep_shape,
            inner_rings: [{ vertices }],
          },
        },
        via,
      ),
    ).toHaveLength(1)
  }
})

test("circular bulge cutouts do not anchor enclosed vias", () => {
  expect(
    check(
      {
        ...pour,
        brep_shape: {
          ...pour.brep_shape,
          inner_rings: [
            {
              vertices: [
                { x: -1, y: 0, bulge: 1 },
                { x: 1, y: 0, bulge: 1 },
              ],
            },
          ],
        },
      },
      via,
    ),
  ).toHaveLength(1)
})

const padRecords = (plated: boolean) => [
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_ground",
    source_port_id: "source_port_ground",
    x: 0,
    y: 0,
    layers: plated ? ["top", "bottom"] : ["bottom"],
  },
  {
    type: "source_trace",
    source_trace_id: "source_trace_ground",
    connected_source_port_ids: ["source_port_ground"],
    connected_source_net_ids: [net.source_net_id],
  },
  plated
    ? {
        type: "pcb_plated_hole",
        pcb_plated_hole_id: "pcb_plated_hole_ground",
        pcb_port_id: "pcb_port_ground",
        shape: "circle",
        x: 0,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      }
    : {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pcb_smtpad_ground",
        pcb_port_id: "pcb_port_ground",
        shape: "rect",
        x: 0,
        y: 0,
        width: 0.6,
        height: 0.6,
        layer: "bottom",
      },
]

test("plated terminals anchor across layers; an opposite-side SMT pad does not", () => {
  expect(check(pour, ...padRecords(true))).toEqual([])
  expect(check(pour, ...padRecords(false))).toHaveLength(1)
  expect(check({ ...pour, layer: "bottom" }, ...padRecords(false))).toEqual([])
})

test("trace copper can connect a pour to a remote terminal", () => {
  const trace = {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_ground",
    source_trace_id: "source_trace_ground",
    route: [0, 4].map((x) => ({
      route_type: "wire",
      x,
      y: 0,
      width: 0.2,
      layer: "top",
    })),
  }
  const records = padRecords(true).map((e) =>
    e.type === "pcb_plated_hole" ? { ...e, x: 4 } : e,
  )
  expect(check(pour, ...records)).toHaveLength(1)
  expect(check(pour, trace, ...records)).toEqual([])
  // A dangling piece of same-net trace is not a terminal.
  expect(check(pour, trace, records[1])).toHaveLength(1)
  expect(
    check(pour, { ...trace, route_thickness_mode: "interpolated" }, ...records),
  ).toEqual([])
})

test("rectangular and polygon pours are checked", () => {
  const rect = {
    ...pour,
    shape: "rect",
    center: { x: 0, y: 0 },
    width: 4,
    height: 4,
  }
  const polygon = { ...pour, shape: "polygon", points: square(2) }
  for (const fill of [rect, polygon]) {
    expect(check(fill)).toHaveLength(1)
    expect(check(fill, via)).toEqual([])
  }
})

test("routing checks include the island diagnostic", async () => {
  const errors = await runAllRoutingChecks([net, pour] as AnyCircuitElement[])
  expect(
    errors.some(
      (error) =>
        error.type === "pcb_copper_pour_isolated_warning" &&
        error.pcb_copper_pour_isolated_warning_id ===
          "pcb_copper_pour_isolated_warning_pcb_copper_pour_island",
    ),
  ).toBe(true)
})

// Reduced directly from the published six-layer AM3352 board. Keep the emitted
// inner-layer BRep coordinates, including the small triangular island.
test("detects an isolated GND island from the AM3352 routing proof", () => {
  const errors = checkCopperPourIslands(am3352Island as AnyCircuitElement[])
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("GND")
  expect(errors[0].message).toContain("inner1")
  expect(errors[0].pcb_copper_pour_isolated_warning_id).toBe(
    "pcb_copper_pour_isolated_warning_plane_inner1_68",
  )
})

test("interpolated trace width can reach a pour that constant width misses", () => {
  const trace = {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_taper",
    source_trace_id: "source_trace_ground",
    route: [
      { route_type: "wire", x: 4, y: 2.5, width: 0.2, layer: "top" },
      { route_type: "wire", x: 0, y: 2.5, width: 1.4, layer: "top" },
    ],
  }
  const anchor = { ...via, x: 4, y: 2.5 }
  expect(check(pour, trace, anchor, padRecords(true)[1])).toHaveLength(1)
  expect(
    check(
      pour,
      { ...trace, route_thickness_mode: "interpolated" },
      anchor,
      padRecords(true)[1],
    ),
  ).toEqual([])
})

test("wire-to-via route segments connect fill to emitted via copper", () => {
  const trace = {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_via",
    source_trace_id: "source_trace_ground",
    route: [
      { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
      { route_type: "via", x: 4, y: 0, from_layer: "top", to_layer: "bottom" },
      { route_type: "wire", x: 5, y: 0, width: 0.2, layer: "bottom" },
    ],
  }
  expect(check(pour, trace, { ...via, x: 4 }, padRecords(true)[1])).toEqual([])
})
