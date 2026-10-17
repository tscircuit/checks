import { expect, test } from "bun:test"
import {
  points,
  outline,
  pour,
  check,
} from "../fixtures/copper-pour-dead-end-fingers"

test("keeps rounded BRep caps, bent fingers, and independent branches", () => {
  const vertices = outline().map((point, i) => ({
    ...point,
    bulge: i === 3 ? 1 : 0,
  }))
  expect(
    check({
      ...pour(),
      shape: "brep",
      brep_shape: { outer_ring: { vertices }, inner_rings: [] },
    }),
  ).toHaveLength(1)
  expect(
    check(
      pour(
        points([
          [0, 0],
          [5, 0],
          [5, 2],
          [9, 2],
          [9, 8],
          [8, 8],
          [8, 3],
          [5, 3],
          [5, 6],
          [0, 6],
        ]),
      ),
    ),
  ).toHaveLength(1)
  const twoFingers = points([
    [0, 0],
    [5, 0],
    [5, 1],
    [10, 1],
    [10, 2],
    [5, 2],
    [5, 4],
    [10, 4],
    [10, 5],
    [5, 5],
    [5, 6],
    [0, 6],
  ])
  expect(check(pour(twoFingers))).toHaveLength(2)
})
