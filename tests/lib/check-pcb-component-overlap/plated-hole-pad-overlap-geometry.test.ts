import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbPlatedHole, PcbSmtPad } from "circuit-json"
import { checkPadPadClearance } from "lib/check-pad-pad-clearance"
import { checkPadTraceClearance } from "lib/check-pad-trace-clearance"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"
import { doPcbElementsOverlap } from "lib/check-pcb-components-overlap/doPcbElementsOverlap"

test("circular plated holes and SMT pads with corner-only bounding-box overlap do not overlap", () => {
  const hole1: PcbPlatedHole = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "hole1",
    pcb_component_id: "comp1",
    shape: "circle",
    x: 0,
    y: 0,
    outer_diameter: 2,
    hole_diameter: 1,
    layers: ["top", "bottom"],
  }
  const hole2: PcbPlatedHole = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "hole2",
    pcb_component_id: "comp2",
    shape: "circle",
    x: 1.6,
    y: 1.6,
    outer_diameter: 2,
    hole_diameter: 1,
    layers: ["top", "bottom"],
  }
  const smtPad: PcbSmtPad = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad1",
    pcb_component_id: "comp3",
    shape: "circle",
    x: -1.6,
    y: 1.6,
    radius: 1,
    layer: "top",
  }

  expect(doPcbElementsOverlap(hole1, hole2)).toBe(false)
  expect(doPcbElementsOverlap(hole1, smtPad)).toBe(false)
  expect(checkPcbComponentOverlap([hole1, hole2, smtPad])).toEqual([])
})

test("plated hole with rect_border_radius respects rounded corners for overlap and clearance", () => {
  const roundedPlatedHole: Extract<
    PcbPlatedHole,
    { shape: "circular_hole_with_rect_pad" }
  > = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "rounded_ph",
    pcb_component_id: "comp1",
    shape: "circular_hole_with_rect_pad",
    hole_shape: "circle",
    pad_shape: "rect",
    x: 0,
    y: 0,
    hole_diameter: 0.5,
    hole_offset_x: 0,
    hole_offset_y: 0,
    rect_pad_width: 2,
    rect_pad_height: 2,
    rect_border_radius: 0.5,
    layers: ["top", "bottom"],
  }
  const cornerObstaclePad: PcbSmtPad = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "corner_pad",
    pcb_component_id: "comp2",
    shape: "circle",
    x: 0.95,
    y: 0.95,
    radius: 0.1,
    layer: "top",
  }

  // At (0.95, 0.95), distance to rounded corner arc center (0.5, 0.5) is sqrt(2)*0.45 = 0.6364mm > 0.5 + 0.1 = 0.6mm
  expect(doPcbElementsOverlap(roundedPlatedHole, cornerObstaclePad)).toBe(false)
  expect(
    doPcbElementsOverlap(
      { ...roundedPlatedHole, rect_border_radius: 0 },
      cornerObstaclePad,
    ),
  ).toBe(true)

  const farCornerPad: PcbSmtPad = {
    ...cornerObstaclePad,
    x: 1.3,
    y: 1.3,
  }
  expect(
    checkPadPadClearance([roundedPlatedHole, farCornerPad], {
      minClearance: 0.5,
    }),
  ).toEqual([])
  expect(
    checkPadPadClearance(
      [{ ...roundedPlatedHole, rect_border_radius: 0 }, farCornerPad],
      { minClearance: 0.5 },
    ),
  ).toHaveLength(1)

  const diagonalTrace: AnyCircuitElement = {
    type: "pcb_trace",
    pcb_trace_id: "trace1",
    route: [
      { route_type: "wire", x: 0.85, y: 1.25, width: 0.1, layer: "top" },
      { route_type: "wire", x: 1.25, y: 0.85, width: 0.1, layer: "top" },
    ],
  }
  expect(
    checkPadTraceClearance([roundedPlatedHole, diagonalTrace], {
      minClearance: 0.1,
    }),
  ).toEqual([])
  expect(
    checkPadTraceClearance(
      [{ ...roundedPlatedHole, rect_border_radius: 0 }, diagonalTrace],
      { minClearance: 0.1 },
    ),
  ).toHaveLength(1)
})

test("rotated rect-pad plated hole and hole_with_polygon_pad outline are respected", () => {
  const rotatedRectPlatedHole: Extract<
    PcbPlatedHole,
    { shape: "circular_hole_with_rect_pad" }
  > = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "rotated_rect_ph",
    pcb_component_id: "comp1",
    shape: "circular_hole_with_rect_pad",
    hole_shape: "circle",
    pad_shape: "rect",
    x: 0,
    y: 0,
    hole_diameter: 0.5,
    hole_offset_x: 0,
    hole_offset_y: 0,
    rect_pad_width: 3,
    rect_pad_height: 1,
    rect_ccw_rotation: 45,
    layers: ["top", "bottom"],
  }
  const padInBoundingBoxCorner: PcbSmtPad = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "corner_pad",
    pcb_component_id: "comp2",
    shape: "rect",
    x: 1,
    y: -1,
    width: 0.4,
    height: 0.4,
    layer: "top",
  }

  expect(
    doPcbElementsOverlap(rotatedRectPlatedHole, padInBoundingBoxCorner),
  ).toBe(false)

  const padAtOffset: PcbSmtPad = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad_at_offset",
    pcb_component_id: "comp2",
    shape: "rect",
    x: 2.2,
    y: 0,
    width: 0.5,
    height: 0.5,
    layer: "top",
  }

  const polygonPlatedHole: Extract<
    PcbPlatedHole,
    { shape: "hole_with_polygon_pad" }
  > = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "poly_ph",
    pcb_component_id: "comp3",
    shape: "hole_with_polygon_pad",
    hole_shape: "circle",
    hole_diameter: 0.4,
    hole_offset_x: 0,
    hole_offset_y: 0,
    x: 0,
    y: 0,
    pad_outline: [
      { x: -0.5, y: -0.5 },
      { x: 2.5, y: -0.5 },
      { x: 2.5, y: 0.5 },
      { x: -0.5, y: 0.5 },
    ],
    layers: ["top", "bottom"],
  }
  expect(doPcbElementsOverlap(polygonPlatedHole, padAtOffset)).toBe(true)
  expect(
    checkPcbComponentOverlap([polygonPlatedHole, padAtOffset]),
  ).toHaveLength(1)
})
