import { expect, test } from "bun:test"
import { points, pour, check } from "../fixtures/copper-pour-dead-end-fingers"

test("detects a copper finger extending into a BRep cutout", () => {
  expect(
    check({
      ...pour(),
      shape: "brep",
      brep_shape: {
        outer_ring: {
          vertices: points([
            [0, 0],
            [15, 0],
            [15, 10],
            [0, 10],
          ]),
        },
        inner_rings: [
          {
            vertices: points([
              [2, 1],
              [13, 1],
              [13, 9],
              [2, 9],
              [2, 5],
              [7, 5],
              [7, 4],
              [2, 4],
            ]),
          },
        ],
      },
    }),
  ).toHaveLength(1)
})
