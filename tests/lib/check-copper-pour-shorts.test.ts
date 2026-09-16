import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkCopperPourShorts, runAllRoutingChecks } from "../../index"
import board from "../fixtures/mspm0g3507-usb-c-dev-board.json"

const square = (r: number) => [
  { x: -r, y: -r },
  { x: r, y: -r },
  { x: r, y: r },
  { x: -r, y: r },
]
const pour = {
  type: "pcb_copper_pour",
  pcb_copper_pour_id: "pour",
  shape: "brep",
  layer: "top",
  source_net_id: "gnd",
  brep_shape: { outer_ring: { vertices: square(5) }, inner_rings: [] },
}
const via = {
  type: "pcb_via",
  pcb_via_id: "via",
  x: 0,
  y: 0,
  outer_diameter: 1,
  hole_diameter: 0.3,
  layers: ["top", "bottom"],
  source_net_id: "signal",
}
const trace = (y: number, width = 0.4) => ({
  type: "pcb_trace",
  pcb_trace_id: "trace",
  source_trace_id: "signal",
  route: [-6, 0, 6].map((x) => ({
    route_type: "wire",
    x,
    y,
    width,
    layer: "top",
  })),
})
const check = (...elements: unknown[]) =>
  checkCopperPourShorts(elements as AnyCircuitElement[])

test("detects the supplied board's ground-pour shorts, including both USB-C VBUS pads", () => {
  const errors = checkCopperPourShorts(board as AnyCircuitElement[])
  expect(errors.map((e) => e.pcb_placement_error_id).sort()).toEqual(
    [
      "copper_pour_short_pcb_copper_pour_51_source_trace_122_0",
      "copper_pour_short_pcb_copper_pour_51_source_trace_48__source_net_2_mst14_0",
      "copper_pour_short_pcb_copper_pour_54_pcb_smtpad_10",
      "copper_pour_short_pcb_copper_pour_54_pcb_smtpad_11",
      "copper_pour_short_pcb_copper_pour_54_source_trace_16_0",
      "copper_pour_short_pcb_copper_pour_82_pcb_via_14",
      "copper_pour_short_pcb_copper_pour_82_source_net_25_0",
      "copper_pour_short_pcb_copper_pour_82_source_net_5_mst3_0",
    ].sort(),
  )
})

test("detects contained copper and edge contact but respects layers and same nets", () => {
  expect(check(pour, via)).toHaveLength(1)
  expect(check(pour, { ...via, x: 5.5 })).toHaveLength(1)
  expect(check(pour, { ...via, x: 5.51 })).toEqual([])
  expect(check(pour, { ...via, layers: ["bottom"] })).toEqual([])
  expect(check(pour, { ...via, source_net_id: "gnd" })).toEqual([])
})

test("resolves same-net pads through source traces and PCB ports", () => {
  const pad = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad",
    pcb_port_id: "port",
    shape: "rect",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    layer: "top",
  }
  expect(check(pour, pad)).toHaveLength(1)
  expect(
    check(
      pour,
      pad,
      { type: "pcb_port", pcb_port_id: "port", source_port_id: "source_port" },
      {
        type: "source_trace",
        source_trace_id: "t",
        connected_source_port_ids: ["source_port"],
        connected_source_net_ids: ["gnd"],
      },
    ),
  ).toEqual([])
})

test("preserves cutouts independent of ring winding", () => {
  for (const vertices of [square(2), square(2).reverse()]) {
    const holePour = {
      ...pour,
      brep_shape: { ...pour.brep_shape, inner_rings: [{ vertices }] },
    }
    expect(check(holePour, via)).toEqual([])
    expect(check(holePour, { ...via, x: 1.6 })).toHaveLength(1)
    expect(
      check(holePour, {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad",
        shape: "rect",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      }),
    ).toEqual([])
    const insideTrace = trace(0)
    insideTrace.route = insideTrace.route.map((p) => ({ ...p, x: p.x / 6 }))
    expect(check(holePour, insideTrace)).toEqual([])
  }
})

test("uses trace width, detects crossings, and deduplicates multiple segments", () => {
  expect(check(pour, trace(0))).toHaveLength(1)
  expect(check(pour, trace(5.1))).toHaveLength(1)
  expect(check(pour, trace(5.3))).toEqual([])
  expect(check(pour, { ...trace(0), source_trace_id: "gnd" })).toEqual([])
})

test("checks rectangular and polygon pours against other pours once per pair", () => {
  const rect = {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "rect",
    shape: "rect",
    center: { x: 0, y: 0 },
    width: 1,
    height: 1,
    layer: "top",
    source_net_id: "signal",
  }
  expect(check(pour, rect)).toHaveLength(1)
  expect(check(pour, { ...rect, source_net_id: "gnd" })).toEqual([])
  expect(
    check(pour, { ...rect, shape: "polygon", points: square(1) }),
  ).toHaveLength(1)
})

test("checks plated holes and rounded or rotated pads", () => {
  expect(
    check(pour, {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "hole",
      shape: "circle",
      x: 0,
      y: 0,
      outer_diameter: 1,
      hole_diameter: 0.5,
      layers: ["top", "bottom"],
    }),
  ).toHaveLength(1)
  expect(
    check(pour, {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad",
      shape: "rotated_pill",
      x: 0,
      y: 0,
      width: 2,
      height: 1,
      radius: 0.5,
      ccw_rotation: 45,
      layer: "top",
    }),
  ).toHaveLength(1)
})

test("is included in routing checks", async () => {
  const errors = await runAllRoutingChecks([pour, via] as AnyCircuitElement[])
  expect(
    errors.some(
      (e) =>
        e.type === "pcb_placement_error" &&
        e.pcb_placement_error_id === "copper_pour_short_pour_via",
    ),
  ).toBe(true)
})

test("respects curved BRep edges and curved cutouts", () => {
  const vertices = [
    { x: 2, y: 0 },
    { x: 0, y: 2 },
    { x: -2, y: 0 },
    { x: 0, y: -2 },
  ].map((p) => ({ ...p, bulge: Math.tan(Math.PI / 8) }))
  const curved = {
    ...pour,
    brep_shape: { outer_ring: { vertices }, inner_rings: [] },
  }
  // Inside the circular arc, but outside the diamond formed by its chords.
  const smallVia = { ...via, x: 1.3, y: 1.3, outer_diameter: 0.1 }
  expect(check(curved, smallVia)).toHaveLength(1)
  const cutout = {
    ...pour,
    brep_shape: { ...pour.brep_shape, inner_rings: [{ vertices }] },
  }
  expect(check(cutout, smallVia)).toEqual([])
  expect(check(cutout, { ...smallVia, x: 1.5, y: 1.5 })).toHaveLength(1)
})
