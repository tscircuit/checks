import { expect, test } from "bun:test"
import {
  points,
  outline,
  pour,
  check,
} from "../fixtures/copper-pour-dead-end-fingers"

test("does not flag broad lobes, short stubs, rectangles, or narrow bridges", () => {
  expect(check()).toEqual([])
  expect(check(pour(outline(1)))).toEqual([])
  expect(check(pour(outline(5, 2)))).toEqual([])
  expect(
    check(
      pour(
        points([
          [0, 0],
          [10, 0],
          [10, 1],
          [0, 1],
        ]),
      ),
    ),
  ).toEqual([])
  const bridge = points([
    [0, 0],
    [5, 0],
    [5, 2],
    [10, 2],
    [10, 0],
    [15, 0],
    [15, 6],
    [10, 6],
    [10, 3],
    [5, 3],
    [5, 6],
    [0, 6],
  ])
  expect(check(pour(bridge))).toEqual([])
})
