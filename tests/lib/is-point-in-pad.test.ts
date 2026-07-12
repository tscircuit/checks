import { expect, test, describe } from "bun:test"
import { isPointInPad } from "lib/check-traces-are-contiguous/is-point-in-pad"
import type { PcbPlatedHole } from "circuit-json"

describe("isPointInPad oval plated hole", () => {
  const ovalPad = {
    type: "pcb_plated_hole",
    shape: "oval",
    x: 0,
    y: 0,
    outer_width: 2,
    outer_height: 1,
  } as unknown as PcbPlatedHole

  test("bounding-box corner is NOT in the oval pad", () => {
    // (0.95, 0.45) is inside the 2x1 bounding box but outside the ellipse
    expect(isPointInPad({ x: 0.95, y: 0.45 }, ovalPad)).toBe(false)
  })

  test("center IS in the oval pad", () => {
    expect(isPointInPad({ x: 0, y: 0 }, ovalPad)).toBe(true)
  })

  test("a clearly-outside point is NOT in the oval pad", () => {
    expect(isPointInPad({ x: 5, y: 5 }, ovalPad)).toBe(false)
  })
})
