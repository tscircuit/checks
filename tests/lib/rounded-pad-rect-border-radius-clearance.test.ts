import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbPlatedHole, PcbSmtPad } from "circuit-json"
import { checkPadPadClearance } from "../../lib/check-pad-pad-clearance"
import {
  getPadToPadGap,
  getTraceObstacleClearance,
} from "../../lib/check-pad-clearance/common"
import { checkPadTraceClearance } from "../../lib/check-pad-trace-clearance"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { checkViaPadClearance } from "../../lib/check-via-pad-clearance"
import { checkViasInPads } from "../../lib/check-vias-in-pads"

const rotate = (x: number, y: number, degrees: number) => {
  const angle = (degrees * Math.PI) / 180
  return {
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  }
}

const smtRectPadWithBorderRadius = (
  rectBorderRadius: number,
  ccwRotation = 0,
): Extract<PcbSmtPad, { shape: "rect" | "rotated_rect" }> =>
  ccwRotation === 0
    ? {
        type: "pcb_smtpad",
        pcb_smtpad_id: "rounded_smt_pad",
        shape: "rect",
        x: 0,
        y: 0,
        width: 2,
        height: 2,
        rect_border_radius: rectBorderRadius,
        layer: "top",
      }
    : {
        type: "pcb_smtpad",
        pcb_smtpad_id: "rounded_smt_pad",
        shape: "rotated_rect",
        x: 0,
        y: 0,
        width: 2,
        height: 2,
        rect_border_radius: rectBorderRadius,
        ccw_rotation: ccwRotation,
        layer: "top",
      }

const platedHoleWithRectPad = (
  shape:
    | "circular_hole_with_rect_pad"
    | "pill_hole_with_rect_pad"
    | "rotated_pill_hole_with_rect_pad",
  rectBorderRadius: number,
  rectCcwRotation = 0,
  width = 2,
  height = 2,
): PcbPlatedHole => {
  if (shape === "circular_hole_with_rect_pad") {
    return {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "rounded_plated_hole",
      shape: "circular_hole_with_rect_pad",
      hole_shape: "circle",
      pad_shape: "rect",
      x: 0,
      y: 0,
      hole_diameter: 0.8,
      rect_pad_width: width,
      rect_pad_height: height,
      rect_border_radius: rectBorderRadius,
      rect_ccw_rotation: rectCcwRotation,
      hole_offset_x: 0,
      hole_offset_y: 0,
      layers: ["top", "bottom"],
    }
  }
  if (shape === "pill_hole_with_rect_pad") {
    return {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "rounded_plated_hole",
      shape: "pill_hole_with_rect_pad",
      hole_shape: "pill",
      pad_shape: "rect",
      x: 0,
      y: 0,
      hole_width: 0.6,
      hole_height: 0.8,
      rect_pad_width: width,
      rect_pad_height: height,
      rect_border_radius: rectBorderRadius,
      hole_offset_x: 0,
      hole_offset_y: 0,
      layers: ["top", "bottom"],
    }
  }
  return {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "rounded_plated_hole",
    shape: "rotated_pill_hole_with_rect_pad",
    hole_shape: "rotated_pill",
    pad_shape: "rect",
    x: 0,
    y: 0,
    hole_width: 0.6,
    hole_height: 0.8,
    hole_ccw_rotation: rectCcwRotation,
    rect_pad_width: width,
    rect_pad_height: height,
    rect_border_radius: rectBorderRadius,
    rect_ccw_rotation: rectCcwRotation,
    hole_offset_x: 0,
    hole_offset_y: 0,
    layers: ["top", "bottom"],
  }
}

const circlePadAt = (d: number, degrees = 0): AnyCircuitElement => ({
  type: "pcb_smtpad",
  pcb_smtpad_id: "other_pad",
  shape: "circle",
  ...rotate(d, d, degrees),
  radius: 0.1,
  layer: "top",
})

const viaAt = (d: number, degrees = 0): AnyCircuitElement => ({
  type: "pcb_via",
  pcb_via_id: "other_via",
  ...rotate(d, d, degrees),
  outer_diameter: 0.2,
  hole_diameter: 0.1,
  layers: ["top", "bottom"],
})

const traceAt = (d: number, degrees = 0): AnyCircuitElement => ({
  type: "pcb_trace",
  pcb_trace_id: "other_trace",
  route: [
    {
      route_type: "wire",
      ...rotate(d, d, degrees),
      width: 0.2,
      layer: "top",
    },
    {
      route_type: "wire",
      ...rotate(2, d, degrees),
      width: 0.2,
      layer: "top",
    },
  ],
})

test("honors rect_border_radius on rect and rotated_rect pcb_smtpad across pad, trace, and via clearances", () => {
  for (const angle of [0, 37]) {
    const rounded = smtRectPadWithBorderRadius(0.5, angle)
    const sharp = smtRectPadWithBorderRadius(0, angle)

    expect(
      checkPadPadClearance([rounded, circlePadAt(1.3, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(0)
    expect(
      checkPadPadClearance([rounded, circlePadAt(1.2, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(1)
    expect(
      checkPadPadClearance([sharp, circlePadAt(1.3, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(1)

    expect(
      checkPadTraceClearance([rounded, traceAt(1.3, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(0)
    expect(
      checkPadTraceClearance([rounded, traceAt(1.2, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(1)
    expect(
      checkPadTraceClearance([sharp, traceAt(1.3, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(1)

    expect(
      checkViaPadClearance([rounded, viaAt(1.3, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(0)
    expect(
      checkViaPadClearance([rounded, viaAt(1.2, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(1)
    expect(
      checkViaPadClearance([sharp, viaAt(1.3, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(1)
  }

  const clamped = smtRectPadWithBorderRadius(4, 0)
  const neighbor: PcbSmtPad = {
    ...smtRectPadWithBorderRadius(1, 0),
    pcb_smtpad_id: "neighbor",
    x: 3,
    y: 0,
  }
  expect(getPadToPadGap(clamped, neighbor)).toBeCloseTo(1, 10)
})

test("honors rect_border_radius on rect-pad pcb_plated_hole clearances and via-in-pad checks", () => {
  for (const [shape, angle] of [
    ["circular_hole_with_rect_pad", 0],
    ["circular_hole_with_rect_pad", 37],
    ["pill_hole_with_rect_pad", 0],
    ["rotated_pill_hole_with_rect_pad", 37],
  ] as const) {
    const rounded = platedHoleWithRectPad(shape, 0.5, angle)
    const sharp = platedHoleWithRectPad(shape, 0, angle)

    expect(
      checkPadPadClearance([rounded, circlePadAt(1.3, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(0)
    expect(
      checkPadPadClearance([rounded, circlePadAt(1.2, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(1)
    expect(
      checkPadPadClearance([sharp, circlePadAt(1.3, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(1)

    expect(
      checkPadTraceClearance([rounded, traceAt(1.3, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(0)
    expect(
      checkPadTraceClearance([rounded, traceAt(1.2, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(1)
    expect(
      checkPadTraceClearance([sharp, traceAt(1.3, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(1)

    expect(
      checkViaPadClearance([rounded, viaAt(1.3, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(0)
    expect(
      checkViaPadClearance([rounded, viaAt(1.2, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(1)
    expect(
      checkViaPadClearance([sharp, viaAt(1.3, angle)], {
        minClearance: 0.5,
      }),
    ).toHaveLength(1)
  }

  // Via positioned outside the rounded corner arc (1.0, 1.0) with 0.3 mm drill:
  // distance from arc center (0.5, 0.5) is sqrt(2)/2 = 0.7071 mm > 0.5 + 0.15 mm.
  const roundedHole = platedHoleWithRectPad("circular_hole_with_rect_pad", 0.5)
  const sharpHole = platedHoleWithRectPad("circular_hole_with_rect_pad", 0)
  const cornerAdjacentVia: AnyCircuitElement = {
    type: "pcb_via",
    pcb_via_id: "via_corner",
    x: 1.0,
    y: 1.0,
    outer_diameter: 0.5,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
  }
  const overlappingVia: AnyCircuitElement = {
    type: "pcb_via",
    pcb_via_id: "via_overlap",
    x: 0.85,
    y: 0.85,
    outer_diameter: 0.5,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
  }
  expect(checkViasInPads([roundedHole, cornerAdjacentVia])).toHaveLength(0)
  expect(checkViasInPads([sharpHole, cornerAdjacentVia])).toHaveLength(1)
  expect(checkViasInPads([roundedHole, overlappingVia])).toHaveLength(1)

  // Fully rounded rotated rectangular plated hole collapses cleanly to a pill.
  const fullRoundedRotatedHole = platedHoleWithRectPad(
    "rotated_pill_hole_with_rect_pad",
    1,
    90,
    4,
    2,
  )
  expect(
    getPadToPadGap(fullRoundedRotatedHole, {
      ...smtRectPadWithBorderRadius(1, 0),
      pcb_smtpad_id: "top_neighbor",
      x: 0,
      y: 4,
    }),
  ).toBeCloseTo(1, 10)

  const traceCheck = getTraceObstacleClearance(
    { x1: 1.2, y1: 1.2, x2: 2, y2: 1.2, thickness: 0.2 },
    roundedHole,
  )
  expect(traceCheck.gap).toBeCloseTo(Math.hypot(0.7, 0.7) - 0.6, 10)
})

test("isPointInPad and contiguity respect rounded rect corners", () => {
  // Trace starting at (0.9, 0.9) is inside the sharp 2x2 bounding square
  // but outside the 0.5 mm corner arc centered at (0.5, 0.5).
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_port",
      source_port_id: "sp1",
      name: "1",
      pin_number: 1,
      port_hints: ["1"],
    },
    {
      type: "source_port",
      source_port_id: "sp2",
      name: "2",
      pin_number: 2,
      port_hints: ["2"],
    },
    {
      type: "source_trace",
      source_trace_id: "st1",
      connected_source_port_ids: ["sp1", "sp2"],
      connected_source_net_ids: [],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pp1",
      source_port_id: "sp1",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pp2",
      source_port_id: "sp2",
      x: 3,
      y: 0,
      layers: ["top"],
    },
    {
      ...smtRectPadWithBorderRadius(0.5, 0),
      pcb_port_id: "pp1",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "target_pad",
      pcb_port_id: "pp2",
      shape: "rect",
      x: 3,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "t1",
      source_trace_id: "st1",
      route: [
        {
          route_type: "wire",
          x: 0.9,
          y: 0.9,
          width: 0.05,
          layer: "top",
          start_pcb_port_id: "pp1",
        },
        {
          route_type: "wire",
          x: 3,
          y: 0,
          width: 0.05,
          layer: "top",
          end_pcb_port_id: "pp2",
        },
      ],
    },
  ]

  // Physical gap from (0.9, 0.9) to rounded corner arc (center 0.5, 0.5, r=0.5)
  // is hypot(0.4, 0.4) - 0.5 = 0.06569 > trace radius 0.025 -> disconnected.
  expect(checkTracesAreContiguous(circuitJson)).toHaveLength(1)
})
