import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbPlatedHole } from "circuit-json"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkPadPadClearance } from "lib/check-pad-pad-clearance"
import { checkPadTraceClearance } from "lib/check-pad-trace-clearance"
import { checkViaPadClearance } from "lib/check-via-pad-clearance"
import { checkViasInPads } from "lib/check-vias-in-pads"

const makePolygonPlatedHole = (
  overrides: Partial<
    Extract<PcbPlatedHole, { shape: "hole_with_polygon_pad" }>
  > = {},
): Extract<PcbPlatedHole, { shape: "hole_with_polygon_pad" }> => ({
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

test("checkViasInPads detects a via inside the polygon pad of hole_with_polygon_pad away from the drill", () => {
  const hole = makePolygonPlatedHole()
  const via: AnyCircuitElement = {
    type: "pcb_via",
    pcb_via_id: "v1",
    x: 1.5,
    y: 1.5,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
  }

  const errors = checkViasInPads([hole, via])
  expect(errors).toHaveLength(1)
  expect(errors[0]?.pcb_placement_error_id).toBe("via_in_pad_v1_ph1")
})

test("checkPadPadClearance detects an SMT pad overlapping or too close to hole_with_polygon_pad copper", () => {
  const hole = makePolygonPlatedHole()
  const smtPad: AnyCircuitElement = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad1",
    shape: "rect",
    x: 1.5,
    y: -1.5,
    width: 0.8,
    height: 0.8,
    layer: "top",
  }

  const errors = checkPadPadClearance([hole, smtPad])
  expect(errors).toHaveLength(1)
  expect(errors[0]?.pcb_pad_ids).toEqual(["pad1", "ph1"])
})

test("checkViaPadClearance detects a via too close to rotated hole_with_polygon_pad outline", () => {
  const hole = makePolygonPlatedHole({
    x: 5,
    y: 0,
    ccw_rotation: 90,
    pad_outline: [
      { x: -0.5, y: -2 },
      { x: 0.5, y: -2 },
      { x: 0.5, y: 2 },
      { x: -0.5, y: 2 },
    ],
  })
  // After 90 deg rotation around (5, 0), pad spans x in [3, 7], y in [-0.5, 0.5]
  const via: AnyCircuitElement = {
    type: "pcb_via",
    pcb_via_id: "v1",
    x: 7.35,
    y: 0,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
  }

  const errors = checkViaPadClearance([hole, via], { minClearance: 0.15 })
  expect(errors).toHaveLength(1)
  expect(errors[0]?.pcb_pad_ids).toEqual(["v1", "ph1"])
  expect(errors[0]?.actual_clearance).toBeCloseTo(0.05, 5)
})

test("checkPadTraceClearance and checkEachPcbTraceNonOverlapping use hole_with_polygon_pad outline", () => {
  const hole = makePolygonPlatedHole()
  const nearTrace: AnyCircuitElement = {
    type: "pcb_trace",
    pcb_trace_id: "t_near",
    route: [
      { route_type: "wire", x: -2, y: 2.13, width: 0.16, layer: "top" },
      { route_type: "wire", x: 2, y: 2.13, width: 0.16, layer: "top" },
    ],
  }
  const overlappingTrace: AnyCircuitElement = {
    type: "pcb_trace",
    pcb_trace_id: "t_overlap",
    route: [
      { route_type: "wire", x: -2, y: 1.5, width: 0.16, layer: "top" },
      { route_type: "wire", x: 2, y: 1.5, width: 0.16, layer: "top" },
    ],
  }

  const clearanceErrors = checkPadTraceClearance([hole, nearTrace], {
    minClearance: 0.1,
  })
  expect(clearanceErrors).toHaveLength(1)
  expect(clearanceErrors[0]?.pcb_pad_id).toBe("ph1")
  expect(clearanceErrors[0]?.pcb_trace_id).toBe("t_near")
  expect(clearanceErrors[0]?.actual_clearance).toBeCloseTo(0.05, 5)

  const overlapErrors = checkEachPcbTraceNonOverlapping([
    hole,
    overlappingTrace,
  ])
  expect(overlapErrors).toHaveLength(1)
  expect(overlapErrors[0]?.type).toBe("pcb_trace_error")
})
