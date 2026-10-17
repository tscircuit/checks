import { expect, test } from "bun:test"
import { points, pour, check } from "../fixtures/copper-pour-dead-end-fingers"

test("finds smooth concave roots without requiring a sharp corner", () => {
  const vertices = points([
    [0, 0],
    [5, 0],
    [5, 1.5],
    [5.5, 2],
    [10, 2],
    [10, 3],
    [5.5, 3],
    [5, 3.5],
    [5, 6],
    [0, 6],
  ]).map((point, i) => ({
    ...point,
    bulge: i === 2 || i === 6 ? -Math.tan(Math.PI / 8) : 0,
  }))
  expect(
    check({
      ...pour(),
      shape: "brep",
      brep_shape: { outer_ring: { vertices }, inner_rings: [] },
    }),
  ).toHaveLength(1)
})
