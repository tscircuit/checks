import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPadPadClearance } from "lib/check-pad-pad-clearance"
import { checkPadTraceClearance } from "lib/check-pad-trace-clearance"
import { checkViaPadClearance } from "lib/check-via-pad-clearance"
import { checkViasInPads } from "lib/check-vias-in-pads"

const board = {
  type: "pcb_board",
  pcb_board_id: "board1",
  center: { x: 0, y: 0 },
  width: 100,
  height: 100,
  thickness: 1.6,
  num_layers: 2,
} as any

const makeHoleWithPolygonPad = (overrides: Record<string, unknown> = {}) => ({
  type: "pcb_plated_hole",
  pcb_plated_hole_id: "ph1",
  shape: "hole_with_polygon_pad",
  hole_shape: "circle",
  hole_diameter: 0.8,
  x: 0,
  y: 0,
  layers: ["top", "bottom"],
  hole_offset_x: 0,
  hole_offset_y: 0,
  pad_outline: [
    { x: -2, y: -2 },
    { x: 2, y: -2 },
    { x: 2, y: 2 },
    { x: -2, y: 2 },
  ],
  ...overrides,
})

const makeVia = (overrides: Record<string, unknown> = {}) => ({
  type: "pcb_via",
  pcb_via_id: "v1",
  x: 1.5,
  y: 1.5,
  outer_diameter: 0.6,
  hole_diameter: 0.3,
  layers: ["top", "bottom"],
  ...overrides,
})

test("checkViasInPads catches a via inside hole_with_polygon_pad copper", () => {
  const hole = makeHoleWithPolygonPad()
  const via = makeVia()

  const errors = checkViasInPads([board, hole, via] as AnyCircuitElement[])

  expect(errors.length).toBe(1)
})

test("checkViasInPads ignores a via outside the polygon copper", () => {
  const hole = makeHoleWithPolygonPad()
  const via = makeVia({ x: 3, y: 3 })

  const errors = checkViasInPads([board, hole, via] as AnyCircuitElement[])

  expect(errors.length).toBe(0)
})

test("checkPadPadClearance catches an SMT pad overlapping the polygon copper", () => {
  const hole = makeHoleWithPolygonPad()
  const smtpad = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad1",
    shape: "rect",
    x: 1.5,
    y: -1.5,
    width: 1,
    height: 1,
    layer: "top",
    port_id: null,
    pcb_component_id: "comp1",
  } as any

  const errors = checkPadPadClearance([board, hole, smtpad] as any)

  expect(errors.length).toBe(1)
})

test("checkViaPadClearance catches a via just outside the polygon outline", () => {
  const hole = makeHoleWithPolygonPad()
  const via = makeVia({ x: 2.35, y: 0 })

  const errors = checkViaPadClearance([board, hole, via] as any)

  expect(errors.length).toBe(1)
})

test("checkPadTraceClearance catches a trace closer than clearance to the polygon copper", () => {
  const hole = makeHoleWithPolygonPad()
  // Default JLCPCB min_trace_to_pad_edge_clearance is 0.1mm. The trace edge
  // sits 0.05mm below the pad copper edge at y=-2, so this must be flagged.
  const trace = {
    type: "pcb_trace",
    pcb_trace_id: "trace1",
    route: [
      {
        route_type: "wire",
        x: 1,
        y: -2.15,
        width: 0.2,
        layer: "top",
        start_pcb_port_id: null,
        end_pcb_port_id: null,
      },
      {
        route_type: "wire",
        x: 1,
        y: -4,
        width: 0.2,
        layer: "top",
        start_pcb_port_id: null,
        end_pcb_port_id: null,
      },
    ],
  } as any

  const errors = checkPadTraceClearance([board, hole, trace] as any, {
    minClearance: 0.15,
  })

  expect(errors.length).toBe(1)
})

test("polygon copper respects ccw_rotation", () => {
  // Rotate the square pad 45 degrees; the corner at (2,0) unrotated moves to
  // (~2.83, 0) rotated. A via at (2.35, 0) is inside the rotated pad copper
  // but was outside the unrotated bounds, and vice versa for (1.5, 1.5).
  const hole = makeHoleWithPolygonPad({ ccw_rotation: 45 })
  const via = makeVia({ x: 2.35, y: 0 })

  const errors = checkViasInPads([board, hole, via] as AnyCircuitElement[])

  expect(errors.length).toBe(1)
})
