import { expect, test } from "bun:test"
import { outline, pour, check } from "../fixtures/copper-pour-dead-end-fingers"

test("is invariant to winding, translation, rotation and straight-edge subdivision", () => {
  for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
    const vertices = outline().map(({ x, y }) => ({
      x: x * Math.cos(angle) - y * Math.sin(angle) - 12.3,
      y: x * Math.sin(angle) + y * Math.cos(angle) + 20.7,
    }))
    expect(check(pour(vertices))).toHaveLength(1)
    expect(check(pour(vertices.toReversed()))).toHaveLength(1)
  }
  const vertices = outline()
  vertices.splice(3, 0, { x: 5.00001, y: 2 }, { x: 8, y: 2 })
  expect(check(pour(vertices))).toHaveLength(1)
})
