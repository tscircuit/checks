import { expect, test } from "bun:test"
import {
  points,
  outline,
  pour,
  check,
} from "../fixtures/copper-pour-dead-end-fingers"

test("respects cutouts and does not mistake copper connected around a hole for a finger", () => {
  for (const reverse of [false, true]) {
    const inner = points([
      [1, 1],
      [4, 1],
      [4, 5],
      [1, 5],
    ])
    if (reverse) inner.reverse()
    expect(
      check({
        ...pour(),
        shape: "brep",
        brep_shape: {
          outer_ring: { vertices: outline() },
          inner_rings: [{ vertices: inner }],
        },
      }),
    ).toHaveLength(1)
    expect(
      check({
        ...pour(),
        shape: "brep",
        brep_shape: {
          outer_ring: {
            vertices: points([
              [0, 0],
              [10, 0],
              [10, 6],
              [0, 6],
            ]),
          },
          inner_rings: [
            {
              vertices: points([
                [1, 1],
                [9, 1],
                [9, 5],
                [1, 5],
              ]),
            },
          ],
        },
      }),
    ).toEqual([])
  }
})
