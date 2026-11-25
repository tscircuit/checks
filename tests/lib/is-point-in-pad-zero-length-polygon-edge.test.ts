import { expect, test } from "bun:test"
import type { PcbSmtPad } from "circuit-json"
import { isPointInPad } from "lib/check-traces-are-contiguous/is-point-in-pad"

const polygonPad = (points: { x: number; y: number }[]): PcbSmtPad => ({
  type: "pcb_smtpad",
  pcb_smtpad_id: "polygon_pad",
  shape: "polygon",
  layer: "top",
  points,
})

const square = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]

const expectOnlyTheSquareContainsPoints = (pad: PcbSmtPad) => {
  expect(isPointInPad({ x: 0.5, y: 0.5 }, pad)).toBe(true)
  expect(isPointInPad({ x: 1, y: 0.5 }, pad)).toBe(true)
  expect(isPointInPad({ x: 0, y: 0 }, pad)).toBe(true)
  expect(isPointInPad({ x: 1.000001, y: 0.5 }, pad)).toBe(false)
  expect(isPointInPad({ x: 50, y: 50 }, pad)).toBe(false)
  expect(isPointInPad({ x: -70, y: 30 }, pad)).toBe(false)
}

test("a repeated polygon vertex does not make every point inside the pad", () => {
  expectOnlyTheSquareContainsPoints(
    polygonPad([square[0]!, square[1]!, square[1]!, square[2]!, square[3]!]),
  )
})

test("an explicitly closed polygon ring does not make every point inside the pad", () => {
  expectOnlyTheSquareContainsPoints(polygonPad([...square, square[0]!]))
})

// Imported footprints produce these: the same vertex after separate decimal
// calculations, differing only in the last bit.
test("a near-duplicate polygon vertex does not make every point inside the pad", () => {
  expectOnlyTheSquareContainsPoints(
    polygonPad([
      square[0]!,
      square[1]!,
      { x: 1 + Number.EPSILON, y: Number.EPSILON },
      square[2]!,
      square[3]!,
    ]),
  )
})

test("floating-point residue on a polygon edge still counts as contact", () => {
  const pad = polygonPad(square)
  expect(isPointInPad({ x: 1.0000000000000002, y: 0.5 }, pad)).toBe(true)
  expect(isPointInPad({ x: 0.5, y: 1.0000000000000002 }, pad)).toBe(true)
  expect(isPointInPad({ x: 0.5, y: 1.000001 }, pad)).toBe(false)
})
