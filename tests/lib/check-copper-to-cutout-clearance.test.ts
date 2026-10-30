import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbCutout,
  PcbTrace,
} from "circuit-json"
import { checkCopperToCutoutClearance } from "../../index"
import { runAllPlacementChecks, runAllRoutingChecks } from "lib/run-all-checks"

const board: PcbBoard = {
  type: "pcb_board",
  pcb_board_id: "pcb_board_test",
  center: { x: 0, y: 0 },
  width: 10,
  height: 10,
  thickness: 1.6,
  num_layers: 4,
  material: "fr4",
  min_board_edge_clearance: 0.2,
}
const cutout: PcbCutout = {
  type: "pcb_cutout",
  pcb_cutout_id: "pcb_cutout_test",
  shape: "rect",
  center: { x: 0, y: 0 },
  width: 2,
  height: 1,
}

// Absolute board coordinates in mm: +X right, +Y up. The stroke's copper
// radius matters even when its centerline misses the cutout.
const horizontalTrace = (y: number, width = 0.4): PcbTrace => ({
  type: "pcb_trace",
  pcb_trace_id: "pcb_trace_test",
  route: [
    { route_type: "wire", x: -2, y, width, layer: "top" },
    { route_type: "wire", x: 2, y, width, layer: "top" },
  ],
})

const cutoutShapes: PcbCutout[] = [
  cutout,
  { ...cutout, rotation: 35 },
  { ...cutout, corner_radius: 0.25 },
  {
    type: "pcb_cutout",
    pcb_cutout_id: "pcb_cutout_circle",
    shape: "circle",
    center: { x: 0, y: 0 },
    radius: 0.5,
  },
  {
    type: "pcb_cutout",
    pcb_cutout_id: "pcb_cutout_polygon",
    shape: "polygon",
    points: [
      { x: -0.5, y: -0.5 },
      { x: 0.5, y: -0.5 },
      { x: 0, y: 0.5 },
    ],
  },
  {
    type: "pcb_cutout",
    pcb_cutout_id: "pcb_cutout_path",
    shape: "path",
    slot_width: 0.5,
    route: [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
    ],
  },
]

test.each(cutoutShapes)("checks $shape cutout geometry", (cutoutShape) => {
  expect(
    checkCopperToCutoutClearance([board, cutoutShape, horizontalTrace(0)]),
  ).toHaveLength(1)
})

test("detects copper brushing a slot despite the centerline missing it", () => {
  const errors = checkCopperToCutoutClearance([
    board,
    cutout,
    horizontalTrace(0.65),
  ])
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    actual_clearance: 0,
    minimum_clearance: 0.2,
  })
})

test("measures edge-to-edge clearance and accepts the exact limit", () => {
  const close = checkCopperToCutoutClearance([
    board,
    cutout,
    horizontalTrace(0.8),
  ])
  expect(close).toHaveLength(1)
  expect(close[0].message).toContain("measured 0.100mm, required 0.200mm")
  expect(
    checkCopperToCutoutClearance([board, cutout, horizontalTrace(0.9)]),
  ).toEqual([])
})

test("detects intersections even with zero required clearance", () => {
  expect(
    checkCopperToCutoutClearance([
      { ...board, min_board_edge_clearance: 0 },
      cutout,
      horizontalTrace(0),
    ]),
  ).toHaveLength(1)
})

test("reports a through-via only once across all four layers", () => {
  const errors = checkCopperToCutoutClearance([
    board,
    cutout,
    {
      type: "pcb_via",
      pcb_via_id: "pcb_via_test",
      x: 0,
      y: 0,
      outer_diameter: 0.45,
      hole_diameter: 0.3,
      layers: ["top", "bottom"],
    },
  ])
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("unnamed via")
  expect(errors[0].message).not.toContain("pcb_via_test")
  expect(errors[0].message).not.toContain("pcb_cutout_test")
})

const fixedCopper: AnyCircuitElement[] = [
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_test",
    shape: "rect",
    x: 0,
    y: 0,
    width: 0.6,
    height: 0.6,
    layer: "bottom",
    pcb_component_id: "pcb_component_usb",
  },
  {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "pcb_plated_hole_test",
    shape: "circle",
    x: 0,
    y: 0,
    hole_diameter: 0.3,
    outer_diameter: 0.8,
    layers: ["top", "bottom"],
  },
  {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "pcb_copper_pour_test",
    shape: "rect",
    center: { x: 0, y: 0 },
    width: 6,
    height: 6,
    rotation: 0,
    layer: "inner2",
    covered_with_solder_mask: true,
  },
]

test.each(fixedCopper)(
  "checks $type copper, including a containing pour",
  (copper) => {
    expect(checkCopperToCutoutClearance([board, cutout, copper])).toHaveLength(
      1,
    )
  },
)

test("does not exempt copper from its own component's cutout", () => {
  expect(
    checkCopperToCutoutClearance([
      board,
      { ...cutout, pcb_component_id: "pcb_component_usb" },
      fixedCopper[0],
    ]),
  ).toHaveLength(1)
})

test("keeps a copper pour's clearance hole empty", () => {
  expect(
    checkCopperToCutoutClearance([
      board,
      cutout,
      {
        type: "pcb_copper_pour",
        pcb_copper_pour_id: "pcb_copper_pour_ring",
        shape: "brep",
        layer: "top",
        covered_with_solder_mask: true,
        brep_shape: {
          outer_ring: {
            vertices: [
              { x: -3, y: -3 },
              { x: 3, y: -3 },
              { x: 3, y: 3 },
              { x: -3, y: 3 },
            ],
          },
          inner_rings: [
            {
              vertices: [
                { x: -1.5, y: -1 },
                { x: 1.5, y: -1 },
                { x: 1.5, y: 1 },
                { x: -1.5, y: 1 },
              ],
            },
          ],
        },
      },
    ]),
  ).toEqual([])
})

test("keeps a large plated hole's drill empty", () => {
  expect(
    checkCopperToCutoutClearance([
      board,
      {
        type: "pcb_cutout",
        pcb_cutout_id: "pcb_cutout_inside_drill",
        shape: "circle",
        center: { x: 0, y: 0 },
        radius: 0.2,
      },
      {
        type: "pcb_plated_hole",
        pcb_plated_hole_id: "pcb_plated_hole_ring",
        shape: "circle",
        x: 0,
        y: 0,
        hole_diameter: 2,
        outer_diameter: 3,
        layers: ["top", "bottom"],
      },
    ]),
  ).toEqual([])
})

test("uses readable trace names and honest unnamed fallbacks", () => {
  const trace = { ...horizontalTrace(0), source_trace_id: "source_trace_test" }
  for (const display_name of ["VM_TO_ADC_DIVIDER", undefined]) {
    const errors = checkCopperToCutoutClearance([
      board,
      cutout,
      {
        type: "source_trace",
        source_trace_id: "source_trace_test",
        display_name,
        connected_source_port_ids: [],
        connected_source_net_ids: [],
      },
      trace,
    ])
    expect(errors[0].message).toContain(display_name ?? "unnamed trace")
    expect(errors[0].message).not.toMatch(
      /pcb_cutout_test|pcb_trace_test|source_trace_test/,
    )
  }
})

test("runs fixed copper checks in placement and trace checks in routing", async () => {
  const circuitJson = [board, cutout, fixedCopper[0], horizontalTrace(0)]
  const placements = await runAllPlacementChecks(circuitJson)
  const routing = await runAllRoutingChecks(circuitJson)
  expect(
    placements.filter((error) => /clearance to cutout/.test(error.message)),
  ).toHaveLength(1)
  expect(
    routing.filter((error) => /clearance to cutout/.test(error.message)),
  ).toHaveLength(1)
})

test("empty circuits and cutout-free copper have nothing to check", () => {
  expect(checkCopperToCutoutClearance([])).toEqual([])
  expect(checkCopperToCutoutClearance([board, horizontalTrace(0)])).toEqual([])
})

test("reports unsupported cutout geometry without throwing or exposing IDs", () => {
  const errors = checkCopperToCutoutClearance([
    board,
    {
      type: "pcb_cutout",
      pcb_cutout_id: "pcb_cutout_patterned",
      shape: "path",
      route: [
        { x: 0, y: -1 },
        { x: 0, y: 1 },
      ],
      slot_width: 0.5,
      slot_length: 0.5,
      space_between_slots: 0.5,
    },
    horizontalTrace(0),
  ])
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain(
    "Cannot verify copper-to-cutout clearance",
  )
  expect(errors[0].message).not.toContain("pcb_cutout_patterned")
})
