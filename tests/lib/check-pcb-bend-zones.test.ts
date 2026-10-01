import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbBend,
  PcbBoard,
  PcbSmtPad,
  PcbStiffener,
  PcbTrace,
  PcbTraceRoutePointThroughPad,
  PcbVia,
} from "circuit-json"
import { checkPcbBendZonePlacement, checkPcbBendZoneTraces } from "../../index"
import {
  runAllChecks,
  runAllPlacementChecks,
  runAllRoutingChecks,
} from "lib/run-all-checks"

const board: PcbBoard = {
  type: "pcb_board",
  pcb_board_id: "board",
  center: { x: 0, y: 0 },
  width: 40,
  height: 20,
  thickness: 0.12,
  num_layers: 2,
  material: "flex",
}
const bend: PcbBend = {
  type: "pcb_bend",
  pcb_bend_id: "bend",
  pcb_board_id: "board",
  start: { x: 0, y: -10 },
  end: { x: 0, y: 10 },
  bend_radius: 1,
  bend_angle: 90,
  bend_side: "left",
}
const via = (id: string, x: number, y: number): PcbVia => ({
  type: "pcb_via",
  pcb_via_id: id,
  x,
  y,
  hole_diameter: 0.2,
  outer_diameter: 0.5,
  layers: ["top", "bottom"],
})
const pad = (
  id: string,
  x: number,
  y: number,
): Extract<PcbSmtPad, { shape: "rect" }> => ({
  type: "pcb_smtpad",
  pcb_smtpad_id: id,
  x,
  y,
  shape: "rect",
  width: 0.5,
  height: 0.5,
  layer: "top",
})
const stiffener: PcbStiffener = {
  type: "pcb_stiffener",
  pcb_stiffener_id: "stiffener",
  pcb_board_id: "board",
  shape: "rect",
  center: { x: 0, y: -7 },
  width: 2,
  height: 2,
  layer: "bottom",
  material: "polyimide",
  thickness: 0.2,
}
const trace = (
  id: string,
  points: [number, number][],
  width = 0.1,
): PcbTrace => ({
  type: "pcb_trace",
  pcb_trace_id: id,
  route: points.map(([x, y]) => ({
    route_type: "wire",
    x,
    y,
    width,
    layer: "top",
  })),
})
const placementIds = (circuit: AnyCircuitElement[]) =>
  checkPcbBendZonePlacement(circuit).map(
    (error) => error.pcb_placement_error_id,
  )
const traceIds = (circuit: AnyCircuitElement[]) =>
  checkPcbBendZoneTraces(circuit).map((error) => error.pcb_trace_id)

test("reports the flex-board reproduction through placement, routing and all checks", async () => {
  const circuit: AnyCircuitElement[] = [
    board,
    bend,
    via("via", 0, 4),
    stiffener,
    trace("corner", [
      [-5, 0],
      [0, 0],
      [0, 3],
    ]),
    pad("pad", 0, -4),
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "plated",
      shape: "circle",
      x: 0,
      y: -2,
      outer_diameter: 0.5,
      hole_diameter: 0.2,
      layers: ["top", "bottom"],
    },
  ]
  expect(placementIds(circuit).sort()).toEqual([
    "bend_zone_bend_pad",
    "bend_zone_bend_plated",
    "bend_zone_bend_stiffener",
    "bend_zone_bend_via",
  ])
  expect(traceIds(circuit)).toEqual(["corner"])
  const placement = await runAllPlacementChecks(circuit)
  const routing = await runAllRoutingChecks(circuit)
  const all = await runAllChecks(circuit)
  expect(
    placement.filter(
      (error) =>
        "pcb_placement_error_id" in error &&
        error.pcb_placement_error_id.startsWith("bend_zone_"),
    ),
  ).toHaveLength(4)
  expect(
    routing.filter(
      (error) =>
        "pcb_trace_error_id" in error &&
        error.pcb_trace_error_id.startsWith("bend_zone_"),
    ),
  ).toHaveLength(1)
  expect(
    all.filter((error) => error.message.includes("PCB bend zone")),
  ).toHaveLength(5)
})

test("uses copper extents and finite segment ends rather than the infinite line", () => {
  const halfWidth = Math.PI / 4
  expect(
    placementIds([
      board,
      bend,
      via("outside_width", halfWidth + 0.3, 0),
      via("overlap_width", halfWidth + 0.2, 0),
      via("outside_end", 0, 10.3),
      via("overlap_end", 0, 10.2),
      pad("far_along_line", 0, 20),
    ]).sort(),
  ).toEqual(["bend_zone_bend_overlap_end", "bend_zone_bend_overlap_width"])
  expect(
    traceIds([
      board,
      bend,
      trace("far_along_line", [
        [0, 15],
        [0, 20],
      ]),
      trace(
        "outside_width",
        [
          [halfWidth + 0.2, -4],
          [halfWidth + 0.2, 4],
        ],
        0.1,
      ),
      trace(
        "overlap_width",
        [
          [halfWidth + 0.2, -4],
          [halfWidth + 0.2, 4],
        ],
        0.5,
      ),
    ]),
  ).toEqual(["overlap_width"])
})

test("translates board-local bends and stiffeners and honors stiffener rotation and polygons", () => {
  const translatedBoard = { ...board, center: { x: 20, y: 40 } }
  const rotated: PcbStiffener = {
    ...stiffener,
    pcb_stiffener_id: "rotated",
    center: { x: 1.2, y: 0 },
    width: 0.2,
    height: 2,
    rotation: 90,
  }
  const polygon: PcbStiffener = {
    type: "pcb_stiffener",
    pcb_stiffener_id: "polygon",
    pcb_board_id: "board",
    shape: "polygon",
    outline: [
      { x: 0, y: 5 },
      { x: 2, y: 5 },
      { x: 2, y: 6 },
    ],
    layer: "top",
    material: "fr4",
    thickness: 0.2,
  }
  const circuit: AnyCircuitElement[] = [
    translatedBoard,
    bend,
    rotated,
    polygon,
    { ...rotated, pcb_stiffener_id: "unrotated", rotation: 0 },
    { ...stiffener, pcb_stiffener_id: "foreign", pcb_board_id: "other_board" },
    via("world", 20, 44),
    via("origin", 0, 4),
    pad("world_pad", 20, 36),
    trace("world_trace", [
      [20, 40],
      [20, 43],
    ]),
    trace("origin_trace", [
      [0, 0],
      [0, 3],
    ]),
  ]
  expect(placementIds(circuit).sort()).toEqual([
    "bend_zone_bend_polygon",
    "bend_zone_bend_rotated",
    "bend_zone_bend_world",
    "bend_zone_bend_world_pad",
  ])
  expect(traceIds(circuit)).toEqual(["world_trace"])
})

test("uses the true outline for diagonal bends and rotated or polygon pads", () => {
  const diagonalBend = { ...bend, start: { x: -5, y: -5 }, end: { x: 5, y: 5 } }
  expect(
    placementIds([
      board,
      diagonalBend,
      via("inside", 2, 2),
      via("aabb_only", -4, 4),
      {
        ...pad("rotated_pad", 2.8, 1.2),
        shape: "rotated_rect",
        width: 3,
        height: 0.2,
        ccw_rotation: 135,
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "polygon_pad",
        shape: "polygon",
        layer: "bottom",
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0 },
          { x: 0.5, y: 0.5 },
        ],
      },
    ]).sort(),
  ).toEqual([
    "bend_zone_bend_inside",
    "bend_zone_bend_polygon_pad",
    "bend_zone_bend_rotated_pad",
  ])
  expect(
    traceIds([
      board,
      diagonalBend,
      trace("perpendicular", [
        [-2, 2],
        [0, 0],
        [2, -2],
      ]),
      trace("parallel", [
        [-2, -2],
        [2, 2],
      ]),
      trace("diagonal", [
        [-2, 0],
        [2, 0],
      ]),
    ]),
  ).toEqual(["parallel", "diagonal"])
})

test("allows straight perpendicular crossings and reports corners once, including reversals", () => {
  const traces = [
    trace("perpendicular", [
      [-5, 0],
      [0, 0],
      [0, 0],
      [5, 0],
    ]),
    trace("reversal", [
      [-5, 1],
      [0, 1],
      [0, 1],
      [-5, 1],
    ]),
    trace("many_corners", [
      [-5, 2],
      [0, 2],
      [0, 3],
      [0.5, 3],
      [0.5, 4],
    ]),
    trace("corner_outside", [
      [-5, 5],
      [-2, 5],
      [-2, 8],
    ]),
  ]
  const errors = checkPcbBendZoneTraces([board, bend, ...traces])
  expect(errors.map((error) => error.pcb_trace_id)).toEqual([
    "reversal",
    "many_corners",
  ])
  expect(errors[0]?.message).toContain("Trace corner")
  expect(errors[0]?.center).toMatchObject({ x: 0, y: 1 })
  expect(errors[0]?.source_trace_id).toBe("")
})

test("checks segments adjacent to vias and treats layer changes as route boundaries", () => {
  const routed: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "wire_to_via",
    source_trace_id: "source_trace",
    route: [
      { route_type: "wire", x: 0, y: -4, layer: "top", width: 0.1 },
      { route_type: "via", x: 0, y: 0, from_layer: "top", to_layer: "bottom" },
      { route_type: "wire", x: 5, y: 0, layer: "bottom", width: 0.1 },
    ],
  }
  const changedLayer: PcbTrace = {
    ...routed,
    pcb_trace_id: "layer_jump",
    route: [
      { route_type: "wire", x: 0, y: -4, layer: "top", width: 0.1 },
      { route_type: "wire", x: 0, y: 0, layer: "bottom", width: 0.1 },
      { route_type: "wire", x: 5, y: 0, layer: "bottom", width: 0.1 },
    ],
  }
  const errors = checkPcbBendZoneTraces([board, bend, routed, changedLayer])
  expect(errors).toHaveLength(1)
  expect(errors[0]?.pcb_trace_id).toBe("wire_to_via")
  expect(errors[0]?.source_trace_id).toBe("source_trace")
})

test("checks incoming and outgoing through-pad copper using the matching face", () => {
  const throughPad: PcbTraceRoutePointThroughPad = {
    route_type: "through_pad",
    start: { x: 5, y: 0 },
    end: { x: 6, y: 0 },
    start_layer: "top",
    end_layer: "bottom",
    width: 0.1,
  }
  const incoming: PcbTrace = {
    ...trace("incoming", []),
    route: [
      { route_type: "wire", x: 0, y: -5, layer: "top", width: 0.1 },
      throughPad,
    ],
  }
  const outgoing: PcbTrace = {
    ...trace("outgoing", []),
    route: [
      throughPad,
      { route_type: "wire", x: 0, y: -5, layer: "bottom", width: 0.1 },
    ],
  }
  const oppositeFace: PcbTrace = {
    ...trace("opposite_face", []),
    route: [
      { ...throughPad, start: { x: -5, y: -5 }, end: { x: -5, y: 5 } },
      { route_type: "wire", x: 5, y: 5, layer: "bottom", width: 0.1 },
    ],
  }
  expect(traceIds([board, bend, incoming, outgoing, oppositeFace])).toEqual([
    "incoming",
    "outgoing",
  ])
})

test("reports route-only vias and deduplicates their materialized physical records", async () => {
  const routeOnly: PcbTrace = {
    ...trace("route_only", []),
    route: [
      { route_type: "wire", x: -5, y: 0, layer: "top", width: 0.1 },
      {
        route_type: "via",
        x: 0,
        y: 0,
        from_layer: "top",
        to_layer: "bottom",
        outer_diameter: 0.5,
        hole_diameter: 0.2,
      },
      { route_type: "wire", x: 5, y: 0, layer: "bottom", width: 0.1 },
    ],
  }
  expect(traceIds([board, bend, routeOnly])).toEqual([])
  expect(placementIds([board, bend, routeOnly])).toEqual([
    "bend_zone_bend_route_only_route_via_1",
  ])
  expect(
    placementIds([board, bend, routeOnly, via("materialized", 0, 0)]),
  ).toEqual(["bend_zone_bend_materialized"])
  const placement = await runAllPlacementChecks([board, bend, routeOnly])
  expect(
    placement.filter((error) => error.message.includes("PCB bend zone")),
  ).toHaveLength(1)
})

test("does not compare copper from another board and resolves nested subcircuit ownership", () => {
  const circuit: AnyCircuitElement[] = [
    { ...board, subcircuit_id: "board_subcircuit" },
    bend,
    {
      ...board,
      pcb_board_id: "other_board",
      subcircuit_id: "other_subcircuit",
    },
    {
      type: "source_group",
      source_group_id: "child_group",
      is_subcircuit: true,
      subcircuit_id: "child",
      parent_subcircuit_id: "board_subcircuit",
    },
    {
      type: "source_group",
      source_group_id: "foreign_group",
      is_subcircuit: true,
      subcircuit_id: "foreign_child",
      parent_subcircuit_id: "other_subcircuit",
    },
    { ...via("nested", 0, 0), subcircuit_id: "child" },
    { ...pad("foreign_pad", 0, 2), subcircuit_id: "foreign_child" },
    { ...via("foreign_via", 0, 4), subcircuit_id: "other_subcircuit" },
    {
      type: "pcb_component",
      pcb_component_id: "foreign_component",
      source_component_id: "source_component",
      positioned_relative_to_pcb_board_id: "other_board",
      center: { x: 0, y: 0 },
      layer: "top",
      rotation: 0,
      width: 0.5,
      height: 0.5,
      obstructs_within_bounds: false,
    },
    {
      ...pad("foreign_component_pad", 0, 0),
      pcb_component_id: "foreign_component",
    },
    {
      ...trace("nested_trace", [
        [0, 5],
        [0, 6],
      ]),
      subcircuit_id: "child",
    },
    {
      ...trace("foreign_trace", [
        [0, 5],
        [0, 6],
      ]),
      subcircuit_id: "foreign_child",
    },
  ]
  expect(placementIds(circuit)).toEqual(["bend_zone_bend_nested"])
  expect(traceIds(circuit)).toEqual(["nested_trace"])
})

test("uses outgoing trace widths, including the maximum width of a tapered segment", () => {
  const narrow: PcbTrace = {
    ...trace("narrow", [
      [1.05, -4],
      [1.05, 4],
    ]),
    route: [
      { route_type: "wire", x: 1.05, y: -4, layer: "top", width: 0.1 },
      // This width belongs to the next outgoing segment, not the incoming one.
      { route_type: "wire", x: 1.05, y: 4, layer: "top", width: 2 },
    ],
  }
  const tapered: PcbTrace = {
    ...narrow,
    pcb_trace_id: "tapered",
    route: [
      {
        route_type: "wire",
        x: 1.05,
        y: -4,
        layer: "top",
        width: 0.1,
        start_width: 0.1,
        end_width: 0.6,
        width_interpolation_mode: "linear",
      },
      narrow.route[1]!,
    ],
  }
  expect(traceIds([board, bend, narrow, tapered])).toEqual(["tapered"])
})

test("uses radius and absolute bend angle, ignores zero or degenerate zones, and stays deterministic", () => {
  const circuit: AnyCircuitElement[] = [
    board,
    { ...bend, bend_angle: -90, bend_side: "right", bend_radius: 2 },
    via("wide_zone", 1.4, 0),
  ]
  expect(placementIds(circuit)).toEqual(["bend_zone_bend_wide_zone"])
  expect(checkPcbBendZonePlacement(circuit)).toEqual(
    checkPcbBendZonePlacement(circuit),
  )
  for (const inactive of [
    { ...bend, bend_angle: 0 },
    { ...bend, end: bend.start },
    { ...bend, bend_radius: 0 },
    { ...bend, pcb_board_id: "missing" },
  ]) {
    expect(
      placementIds([board, inactive, via("via", 0, 0), stiffener]),
    ).toEqual([])
    expect(
      traceIds([
        board,
        inactive,
        trace("trace", [
          [0, 0],
          [0, 3],
        ]),
      ]),
    ).toEqual([])
  }
  expect(placementIds([board, via("via", 0, 0)])).toEqual([])
})
