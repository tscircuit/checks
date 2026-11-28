import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PCBKeepout,
  PcbPlatedHole,
  PcbSmtPad,
  PcbVia,
} from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import {
  getPadToPadGap,
  getTraceObstacleClearance,
} from "lib/check-pad-clearance/common"
import { checkPadPadClearance } from "lib/check-pad-pad-clearance"
import { checkPadTraceClearance } from "lib/check-pad-trace-clearance"
import { checkPcbCopperOverKeepout } from "lib/check-pcb-copper-over-keepout"
import { checkViaPadClearance } from "lib/check-via-pad-clearance"
import { checkViasInPads } from "lib/check-vias-in-pads"

const rotatePoint = (x: number, y: number, angleDeg: number) => {
  const angle = (angleDeg * Math.PI) / 180
  return {
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  }
}

const circularRectPlatedHole = ({
  id = "plated_rect",
  x = 0,
  y = 0,
  width = 2,
  height = 2,
  rectBorderRadius = 0.5,
  rectCcwRotation = 0,
}: {
  id?: string
  x?: number
  y?: number
  width?: number
  height?: number
  rectBorderRadius?: number
  rectCcwRotation?: number
} = {}): Extract<PcbPlatedHole, { shape: "circular_hole_with_rect_pad" }> => ({
  type: "pcb_plated_hole",
  pcb_plated_hole_id: id,
  shape: "circular_hole_with_rect_pad",
  hole_shape: "circle",
  pad_shape: "rect",
  x,
  y,
  hole_diameter: 0.6,
  hole_offset_x: 0,
  hole_offset_y: 0,
  rect_pad_width: width,
  rect_pad_height: height,
  rect_border_radius: rectBorderRadius,
  rect_ccw_rotation: rectCcwRotation,
  layers: ["top", "bottom"],
})

const rotatedPillRectPlatedHole = ({
  id = "rotated_pill_rect",
  x = 0,
  y = 0,
  width = 2,
  height = 2,
  rectBorderRadius = 0.5,
  rectCcwRotation = 37,
}: {
  id?: string
  x?: number
  y?: number
  width?: number
  height?: number
  rectBorderRadius?: number
  rectCcwRotation?: number
} = {}): Extract<
  PcbPlatedHole,
  { shape: "rotated_pill_hole_with_rect_pad" }
> => ({
  type: "pcb_plated_hole",
  pcb_plated_hole_id: id,
  shape: "rotated_pill_hole_with_rect_pad",
  hole_shape: "rotated_pill",
  pad_shape: "rect",
  x,
  y,
  hole_width: 0.8,
  hole_height: 0.4,
  hole_ccw_rotation: rectCcwRotation,
  hole_offset_x: 0,
  hole_offset_y: 0,
  rect_pad_width: width,
  rect_pad_height: height,
  rect_border_radius: rectBorderRadius,
  rect_ccw_rotation: rectCcwRotation,
  layers: ["top", "bottom"],
})

const pillRectPlatedHole = ({
  id = "pill_rect",
  x = 0,
  y = 0,
  width = 2,
  height = 2,
  rectBorderRadius = 0.5,
}: {
  id?: string
  x?: number
  y?: number
  width?: number
  height?: number
  rectBorderRadius?: number
} = {}): Extract<PcbPlatedHole, { shape: "pill_hole_with_rect_pad" }> => ({
  type: "pcb_plated_hole",
  pcb_plated_hole_id: id,
  shape: "pill_hole_with_rect_pad",
  hole_shape: "pill",
  pad_shape: "rect",
  x,
  y,
  hole_width: 0.8,
  hole_height: 0.4,
  hole_offset_x: 0,
  hole_offset_y: 0,
  rect_pad_width: width,
  rect_pad_height: height,
  rect_border_radius: rectBorderRadius,
  layers: ["top", "bottom"],
})

const makeCornerTrace = (d: number, angleDeg = 0): AnyCircuitElement => ({
  type: "pcb_trace",
  pcb_trace_id: "corner_trace",
  route: [
    {
      route_type: "wire",
      ...rotatePoint(d, d, angleDeg),
      width: 0.2,
      layer: "top",
    },
    {
      route_type: "wire",
      ...rotatePoint(2.5, d, angleDeg),
      width: 0.2,
      layer: "top",
    },
  ],
})

test("snapshots rounded rectangular plated-hole clearance at 37 degrees", () => {
  const hole = circularRectPlatedHole({
    rectBorderRadius: 0.5,
    rectCcwRotation: 37,
  })
  const trace = makeCornerTrace(1.3, 37)
  const via: PcbVia = {
    type: "pcb_via",
    pcb_via_id: "corner_via",
    ...rotatePoint(-1.25, -1.25, 37),
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
  }
  const elements: AnyCircuitElement[] = [hole, trace, via]
  expect(checkPadTraceClearance(elements, { minClearance: 0.5 })).toHaveLength(
    0,
  )
  expect(checkViaPadClearance(elements, { minClearance: 0.2 })).toHaveLength(0)

  const svg = convertCircuitJsonToPcbSvg(elements, {
    width: 500,
    height: 500,
    layer: "top",
  })
  expect(svg).toMatchSvgSnapshot(
    import.meta.path,
    "rounded-plated-hole-clearance",
  )
})

test("measures exact rounded corner geometry for rectangular plated holes", () => {
  const a = circularRectPlatedHole({
    id: "a",
    x: 0,
    y: 0,
    rectBorderRadius: 0.5,
  })
  const b = circularRectPlatedHole({
    id: "b",
    x: 2.2,
    y: 2.2,
    rectBorderRadius: 0.5,
  })
  const expected = Math.hypot(1.2, 1.2) - 1
  expect(getPadToPadGap(a, b)).toBeCloseTo(expected, 10)
  expect(getPadToPadGap(b, a)).toBeCloseTo(expected, 10)

  // Fully rounded square (collapses inset to a point/circle)
  expect(
    getPadToPadGap(
      circularRectPlatedHole({ id: "sq_a", x: 0, y: 0, rectBorderRadius: 1 }),
      circularRectPlatedHole({ id: "sq_b", x: 3, y: 0, rectBorderRadius: 1 }),
    ),
  ).toBeCloseTo(1, 10)

  // Fully rounded rotated rectangle (collapses inset to pill geometry)
  expect(
    getPadToPadGap(
      rotatedPillRectPlatedHole({
        id: "stadium_a",
        x: 0,
        y: 0,
        width: 4,
        height: 2,
        rectBorderRadius: 1,
        rectCcwRotation: 90,
      }),
      circularRectPlatedHole({
        id: "stadium_b",
        x: 0,
        y: 4,
        rectBorderRadius: 1,
      }),
    ),
  ).toBeCloseTo(1, 10)

  // Clamps oversized rect_border_radius to half the smaller dimension
  expect(
    getPadToPadGap(
      circularRectPlatedHole({
        id: "clamp_a",
        x: 0,
        y: 0,
        rectBorderRadius: 5,
      }),
      circularRectPlatedHole({
        id: "clamp_b",
        x: 3,
        y: 0,
        rectBorderRadius: 1,
      }),
    ),
  ).toBeCloseTo(1, 10)

  // Places clearance marker between the actual rounded copper edges
  const traceClearance = getTraceObstacleClearance(
    { x1: 1.2, y1: 1.2, x2: 2, y2: 1.2, thickness: 0.2 },
    a,
  )
  expect(traceClearance.gap).toBeCloseTo(Math.hypot(0.7, 0.7) - 0.6, 10)
  const edgeMidpoint = (1.2 - 0.1 / Math.SQRT2 + 0.5 + 0.5 / Math.SQRT2) / 2
  expect(traceClearance.center.x).toBeCloseTo(edgeMidpoint, 10)
  expect(traceClearance.center.y).toBeCloseTo(edgeMidpoint, 10)
})

test("respects rect_border_radius across all three rectangular plated-hole shapes in trace clearance", () => {
  // Corner arc at (0.5, 0.5) r=0.5; trace r=0.1 at (d, d):
  // d=1.3 -> gap=0.53137mm (legal); d=1.2 -> gap=0.38995mm (violation);
  // sharp corner (radius=0) at d=1.3 -> gap=0.32426mm (violation).
  const cases: Array<{
    rounded: PcbPlatedHole
    sharp: PcbPlatedHole
    angle: number
  }> = [
    {
      rounded: circularRectPlatedHole({ rectBorderRadius: 0.5 }),
      sharp: circularRectPlatedHole({ rectBorderRadius: 0 }),
      angle: 0,
    },
    {
      rounded: circularRectPlatedHole({
        rectBorderRadius: 0.5,
        rectCcwRotation: 37,
      }),
      sharp: circularRectPlatedHole({
        rectBorderRadius: 0,
        rectCcwRotation: 37,
      }),
      angle: 37,
    },
    {
      rounded: pillRectPlatedHole({ rectBorderRadius: 0.5 }),
      sharp: pillRectPlatedHole({ rectBorderRadius: 0 }),
      angle: 0,
    },
    {
      rounded: rotatedPillRectPlatedHole({
        rectBorderRadius: 0.5,
        rectCcwRotation: 37,
      }),
      sharp: rotatedPillRectPlatedHole({
        rectBorderRadius: 0,
        rectCcwRotation: 37,
      }),
      angle: 37,
    },
  ]

  for (const { rounded, sharp, angle } of cases) {
    expect(
      checkPadTraceClearance([rounded, makeCornerTrace(1.3, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(0)
    expect(
      checkPadTraceClearance([rounded, makeCornerTrace(1.2, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(1)
    expect(
      checkPadTraceClearance([sharp, makeCornerTrace(1.3, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(1)
  }
})

test("respects rect_border_radius in pad-pad, via-pad, via-in-pad, overlap, and keepout checks", () => {
  const rounded = circularRectPlatedHole({ id: "pad_a", rectBorderRadius: 0.5 })
  const sharp = circularRectPlatedHole({ id: "pad_a", rectBorderRadius: 0 })

  // 1. Pad-to-pad clearance
  const neighborLegal = circularRectPlatedHole({
    id: "pad_b",
    x: 1.85,
    y: 1.85,
    rectBorderRadius: 0.5,
  })
  const neighborTooClose = circularRectPlatedHole({
    id: "pad_b",
    x: 1.8,
    y: 1.8,
    rectBorderRadius: 0.5,
  })
  expect(
    checkPadPadClearance([rounded, neighborLegal], { minClearance: 0.2 }),
  ).toHaveLength(0)
  expect(
    checkPadPadClearance([rounded, neighborTooClose], { minClearance: 0.2 }),
  ).toHaveLength(1)
  expect(
    checkPadPadClearance([sharp, neighborLegal], { minClearance: 0.2 }),
  ).toHaveLength(1)

  // 2. Via-to-pad clearance
  const viaLegal: PcbVia = {
    type: "pcb_via",
    pcb_via_id: "via_legal",
    x: 1.25,
    y: 1.25,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
  }
  expect(
    checkViaPadClearance([rounded, viaLegal], { minClearance: 0.2 }),
  ).toHaveLength(0)
  expect(
    checkViaPadClearance([sharp, viaLegal], { minClearance: 0.2 }),
  ).toHaveLength(1)

  // 3. Via-in-pad (drill outside rounded corner, inside phantom sharp corner)
  const viaNearCorner: PcbVia = {
    type: "pcb_via",
    pcb_via_id: "via_corner",
    x: 0.98,
    y: 0.98,
    outer_diameter: 0.5,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
  }
  expect(checkViasInPads([rounded, viaNearCorner])).toHaveLength(0)
  expect(checkViasInPads([sharp, viaNearCorner])).toHaveLength(1)

  // 4. Trace overlap (checkEachPcbTraceNonOverlapping)
  expect(
    checkEachPcbTraceNonOverlapping([rounded, makeCornerTrace(0.96, 0)]),
  ).toHaveLength(0)
  expect(
    checkEachPcbTraceNonOverlapping([rounded, makeCornerTrace(0.9, 0)]),
  ).toHaveLength(1)
  expect(
    checkEachPcbTraceNonOverlapping([sharp, makeCornerTrace(0.96, 0)]),
  ).toHaveLength(1)

  // 5. Copper-over-keepout
  const keepout: PCBKeepout = {
    type: "pcb_keepout",
    pcb_keepout_id: "keepout_corner",
    shape: "rect",
    center: { x: 1.42, y: 1.42 },
    width: 1,
    height: 1,
    layers: ["top"],
  }
  expect(checkPcbCopperOverKeepout([rounded, keepout])).toHaveLength(0)
  expect(checkPcbCopperOverKeepout([sharp, keepout])).toHaveLength(1)
})

test("respects rect_border_radius on rect and rotated_rect pcb_smtpad elements", () => {
  const rectSmtPad: Extract<PcbSmtPad, { shape: "rect" }> = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "smt_rect_border_radius",
    shape: "rect",
    x: 0,
    y: 0,
    width: 2,
    height: 2,
    rect_border_radius: 0.5,
    layer: "top",
  }
  const rotatedSmtPad: Extract<PcbSmtPad, { shape: "rotated_rect" }> = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "smt_rotated_rect_border_radius",
    shape: "rotated_rect",
    x: 0,
    y: 0,
    width: 2,
    height: 2,
    rect_border_radius: 0.5,
    ccw_rotation: 37,
    layer: "top",
  }

  expect(
    checkPadTraceClearance([rectSmtPad, makeCornerTrace(1.3, 0)], {
      minClearance: 0.5,
    }),
  ).toHaveLength(0)
  expect(
    checkPadTraceClearance([rectSmtPad, makeCornerTrace(1.2, 0)], {
      minClearance: 0.5,
    }),
  ).toHaveLength(1)
  expect(
    checkPadTraceClearance([rotatedSmtPad, makeCornerTrace(1.3, 37)], {
      minClearance: 0.5,
    }),
  ).toHaveLength(0)
  expect(
    checkPadTraceClearance([rotatedSmtPad, makeCornerTrace(1.2, 37)], {
      minClearance: 0.5,
    }),
  ).toHaveLength(1)
})
