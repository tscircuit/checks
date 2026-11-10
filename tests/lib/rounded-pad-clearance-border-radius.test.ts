import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPadTraceClearance } from "../../lib/check-pad-trace-clearance"
import { checkViaPadClearance } from "../../lib/check-via-pad-clearance"

const point = (x: number, y: number) => ({ x, y })

const smtPadWithRectBorderRadius = (
  rectBorderRadius?: number,
): AnyCircuitElement => ({
  type: "pcb_smtpad",
  pcb_smtpad_id: "rounded_pad_border_radius",
  shape: "rect",
  x: 0,
  y: 0,
  width: 2,
  height: 2,
  rect_border_radius: rectBorderRadius,
  layer: "top",
})

const platedHoleWithRectBorderRadius = (
  rectBorderRadius?: number,
): AnyCircuitElement => ({
  type: "pcb_plated_hole",
  pcb_plated_hole_id: "plated_hole_rect_border_radius",
  shape: "circular_hole_with_rect_pad",
  hole_shape: "circle",
  pad_shape: "rect",
  hole_diameter: 0.8,
  rect_pad_width: 2,
  rect_pad_height: 2,
  rect_border_radius: rectBorderRadius,
  hole_offset_x: 0,
  hole_offset_y: 0,
  x: 0,
  y: 0,
  layers: ["top", "bottom"],
})

const traceObstacle = (d: number): AnyCircuitElement => ({
  type: "pcb_trace",
  pcb_trace_id: "other_trace",
  route: [
    { route_type: "wire", ...point(d, d), width: 0.2, layer: "top" },
    { route_type: "wire", ...point(2, d), width: 0.2, layer: "top" },
  ],
})

const viaObstacle = (d: number): AnyCircuitElement => ({
  type: "pcb_via",
  pcb_via_id: "other_via",
  x: d,
  y: d,
  outer_diameter: 0.6,
  hole_diameter: 0.3,
  layers: ["top", "bottom"],
})

test("accepts legal pad-to-trace gap with rect_border_radius: 0.5", () => {
  const errors = checkPadTraceClearance(
    [smtPadWithRectBorderRadius(0.5), traceObstacle(1.3)],
    { minClearance: 0.5 },
  )
  expect(errors).toHaveLength(0)
})

test("rejects closer trace start at (1.2, 1.2) with rect_border_radius: 0.5", () => {
  const errors = checkPadTraceClearance(
    [smtPadWithRectBorderRadius(0.5), traceObstacle(1.2)],
    { minClearance: 0.5 },
  )
  expect(errors).toHaveLength(1)
})

test("rejects sharp corners (rect_border_radius: undefined/0) at d=1.3", () => {
  const errorsUndef = checkPadTraceClearance(
    [smtPadWithRectBorderRadius(undefined), traceObstacle(1.3)],
    { minClearance: 0.5 },
  )
  expect(errorsUndef).toHaveLength(1)

  const errorsZero = checkPadTraceClearance(
    [smtPadWithRectBorderRadius(0), traceObstacle(1.3)],
    { minClearance: 0.5 },
  )
  expect(errorsZero).toHaveLength(1)
})

test("accepts legal pad-to-trace gap for plated hole with rect_border_radius: 0.5", () => {
  const errors = checkPadTraceClearance(
    [platedHoleWithRectBorderRadius(0.5), traceObstacle(1.3)],
    { minClearance: 0.5 },
  )
  expect(errors).toHaveLength(0)
})

test("rejects closer trace start at (1.2, 1.2) for plated hole with rect_border_radius: 0.5", () => {
  const errors = checkPadTraceClearance(
    [platedHoleWithRectBorderRadius(0.5), traceObstacle(1.2)],
    { minClearance: 0.5 },
  )
  expect(errors).toHaveLength(1)
})

test("rejects sharp corners for plated hole at d=1.3", () => {
  const errors = checkPadTraceClearance(
    [platedHoleWithRectBorderRadius(0), traceObstacle(1.3)],
    { minClearance: 0.5 },
  )
  expect(errors).toHaveLength(1)
})

test("respects rect_border_radius in via-to-pad clearance checks", () => {
  // Via outer_diameter is 0.6 (radius 0.3).
  // Corner arc center at (0.5, 0.5), radius 0.5.
  // At d=1.5: distance to arc center = sqrt(1.0^2 + 1.0^2) = 1.4142.
  // Gap = 1.4142 - 0.5 - 0.3 = 0.6142 >= 0.5 -> pass.
  const errorsLegal = checkViaPadClearance(
    [smtPadWithRectBorderRadius(0.5), viaObstacle(1.5)],
    { minClearance: 0.5 },
  )
  expect(errorsLegal).toHaveLength(0)

  // At d=1.3: distance to arc center = sqrt(0.8^2 + 0.8^2) = 1.1314.
  // Gap = 1.1314 - 0.5 - 0.3 = 0.3314 < 0.5 -> violation.
  const errorsCloser = checkViaPadClearance(
    [smtPadWithRectBorderRadius(0.5), viaObstacle(1.3)],
    { minClearance: 0.5 },
  )
  expect(errorsCloser).toHaveLength(1)
})
