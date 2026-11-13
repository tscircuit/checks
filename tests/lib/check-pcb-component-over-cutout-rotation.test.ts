import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbComponent, PcbCutout } from "circuit-json"
import { checkPcbComponentOverCutout } from "lib/check-pcb-component-over-cutout"

test("checkPcbComponentOverCutout respects component rotation", () => {
  // A 10x2 component centered at (0, 0).
  // At rotation 0: x spans [-5, 5], y spans [-1, 1].
  // At rotation 90: x spans [-1, 1], y spans [-5, 5].

  // Cutout at (0, 3) of size 2x2 (x in [-1, 1], y in [2, 4]):
  // - With rotation 0: y max is 1, so no collision.
  // - With rotation 90: y extends to 5, colliding with cutout [2, 4].
  const cutoutY3: PcbCutout = {
    type: "pcb_cutout",
    pcb_cutout_id: "cutout_y3",
    shape: "rect",
    center: { x: 0, y: 3 },
    width: 2,
    height: 2,
  }

  const unrotatedAtCutoutY3: AnyCircuitElement[] = [
    {
      type: "pcb_component",
      pcb_component_id: "c1",
      source_component_id: "s1",
      center: { x: 0, y: 0 },
      width: 10,
      height: 2,
      rotation: 0,
      layer: "top",
      obstructs_within_bounds: true,
    },
    cutoutY3,
  ]
  expect(checkPcbComponentOverCutout(unrotatedAtCutoutY3)).toHaveLength(0)

  const rotatedAtCutoutY3: AnyCircuitElement[] = [
    {
      type: "pcb_component",
      pcb_component_id: "c1",
      source_component_id: "s1",
      center: { x: 0, y: 0 },
      width: 10,
      height: 2,
      rotation: 90,
      layer: "top",
      obstructs_within_bounds: true,
    },
    cutoutY3,
  ]
  const errorsRotated = checkPcbComponentOverCutout(rotatedAtCutoutY3)
  expect(errorsRotated).toHaveLength(1)
  expect(errorsRotated[0].pcb_placement_error_id).toBe(
    "component_over_cutout_c1_cutout_y3",
  )

  // Cutout at (3, 0) of size 2x2 (x in [2, 4], y in [-1, 1]):
  // - With rotation 0: x extends to 5, colliding with cutout [2, 4].
  // - With rotation 90: x spans only [-1, 1], avoiding cutout at x=3.
  const cutoutX3: PcbCutout = {
    type: "pcb_cutout",
    pcb_cutout_id: "cutout_x3",
    shape: "rect",
    center: { x: 3, y: 0 },
    width: 2,
    height: 2,
  }

  const unrotatedAtCutoutX3: AnyCircuitElement[] = [
    {
      type: "pcb_component",
      pcb_component_id: "c1",
      source_component_id: "s1",
      center: { x: 0, y: 0 },
      width: 10,
      height: 2,
      rotation: 0,
      layer: "top",
      obstructs_within_bounds: true,
    },
    cutoutX3,
  ]
  expect(checkPcbComponentOverCutout(unrotatedAtCutoutX3)).toHaveLength(1)

  const rotatedAwayFromCutoutX3: AnyCircuitElement[] = [
    {
      type: "pcb_component",
      pcb_component_id: "c1",
      source_component_id: "s1",
      center: { x: 0, y: 0 },
      width: 10,
      height: 2,
      rotation: 90,
      layer: "top",
      obstructs_within_bounds: true,
    },
    cutoutX3,
  ]
  expect(checkPcbComponentOverCutout(rotatedAwayFromCutoutX3)).toHaveLength(0)
})

test("checkPcbComponentOverCutout handles 45-degree rotated component", () => {
  // Square 2x2 component rotated 45 deg centered at (0, 0).
  // Corners are at distance sqrt(2) ≈ 1.414 along axes (±1.414, 0) and (0, ±1.414).
  // A circular cutout of radius 0.2 at (1.3, 0):
  // - Unrotated box reaches only x = 1.0 (no overlap with circle at x=1.3..1.5).
  // - Rotated 45-deg corner extends to x = 1.414, overlapping the circle at (1.3, 0).
  const component45: PcbComponent = {
    type: "pcb_component",
    pcb_component_id: "c45",
    source_component_id: "s45",
    center: { x: 0, y: 0 },
    width: 2,
    height: 2,
    rotation: 45,
    layer: "top",
    obstructs_within_bounds: true,
  }

  const circularCutout: PcbCutout = {
    type: "pcb_cutout",
    pcb_cutout_id: "cutout_circle",
    shape: "circle",
    center: { x: 1.3, y: 0 },
    radius: 0.2,
  }

  const errors = checkPcbComponentOverCutout([component45, circularCutout])
  expect(errors).toHaveLength(1)

  // When unrotated, corner is at (1, 1), and edge at x=1 does not reach x=1.1 (circle's min x).
  const componentUnrotated: PcbComponent = {
    ...component45,
    rotation: 0,
  }
  expect(
    checkPcbComponentOverCutout([componentUnrotated, circularCutout]),
  ).toHaveLength(0)
})
