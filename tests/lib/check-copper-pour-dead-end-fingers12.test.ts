import { expect, test } from "bun:test"
import {
  points,
  pour,
  via,
  check,
} from "../fixtures/copper-pour-dead-end-fingers"

test("a connected fork does not hide its unsupported child branch", () => {
  const fork = pour(
    points([
      [0, 0],
      [5, 0],
      [5, 2],
      [8, 2],
      [8, -4],
      [9, -4],
      [9, 8],
      [8, 8],
      [8, 3],
      [5, 3],
      [5, 6],
      [0, 6],
    ]),
  )
  const errors = check(fork, { ...via(8.5), y: 7.5 })
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("-4.00mm")
})
