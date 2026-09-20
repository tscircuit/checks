import { expect, test } from "bun:test"
import type { PcbSmtPad } from "circuit-json"
import {
  getPadToPadGap,
  getTraceObstacleClearance,
} from "../../lib/check-pad-clearance/common"

const pad = (
  x: number,
  y: number,
  radius: number,
): Extract<PcbSmtPad, { shape: "rect" }> => ({
  type: "pcb_smtpad",
  pcb_smtpad_id: `pad_${x}_${y}`,
  shape: "rect",
  x,
  y,
  width: 2,
  height: 2,
  corner_radius: radius,
  layer: "top",
})

test("subtracts both corner radii for two rounded pads", () => {
  const a = pad(0, 0, 0.5)
  const b = pad(2.2, 2.2, 0.5)
  const expected = Math.hypot(1.2, 1.2) - 1
  expect(getPadToPadGap(a, b)).toBeCloseTo(expected, 10)
  expect(getPadToPadGap(b, a)).toBeCloseTo(expected, 10)
})

test("handles a fully rounded square without a degenerate polygon", () => {
  expect(getPadToPadGap(pad(0, 0, 1), pad(3, 0, 1))).toBeCloseTo(1, 10)
})

test("handles a fully rounded rotated rectangle as a pill", () => {
  const rounded: PcbSmtPad = {
    ...pad(0, 0, 1),
    shape: "rotated_rect",
    width: 4,
    ccw_rotation: 90,
  }
  expect(getPadToPadGap(rounded, pad(0, 4, 1))).toBeCloseTo(1, 10)
})

test("clamps an oversized corner radius to half the smaller dimension", () => {
  expect(getPadToPadGap(pad(0, 0, 4), pad(3, 0, 1))).toBeCloseTo(1, 10)
})

test("places the error marker between the actual rounded copper edges", () => {
  const result = getTraceObstacleClearance(
    { x1: 1.2, y1: 1.2, x2: 2, y2: 1.2, thickness: 0.2 },
    pad(0, 0, 0.5),
  )
  expect(result.gap).toBeCloseTo(Math.hypot(0.7, 0.7) - 0.6, 10)
  const edgeMidpoint = (1.2 - 0.1 / Math.SQRT2 + 0.5 + 0.5 / Math.SQRT2) / 2
  expect(result.center.x).toBeCloseTo(edgeMidpoint, 10)
  expect(result.center.y).toBeCloseTo(edgeMidpoint, 10)
})

test("detects copper overlap at a rounded corner", () => {
  const result = getTraceObstacleClearance(
    { x1: 0.9, y1: 0.9, x2: 2, y2: 0.9, thickness: 0.2 },
    pad(0, 0, 0.5),
  )
  expect(result.gap).toBeLessThan(0)
})
