import { expect, test } from "bun:test"
import {
  board,
  bend,
  via,
  pad,
  trace,
  placementIds,
  traceIds,
} from "../fixtures/pcb-bend-zones"

test("uses copper extents and finite segment ends rather than the infinite line", () => {
  const halfWidth = Math.PI / 4
  expect(
    placementIds([
      board,
      bend,
      via("outside_width", halfWidth + 0.3, 0),
      via("overlap_width", halfWidth + 0.2, 0),
      via("outside_end", 0, 10.3),
      via("overlap_end", 0, 10.2),
      pad("far_along_line", 0, 20),
    ]).sort(),
  ).toEqual(["bend_zone_bend_overlap_end", "bend_zone_bend_overlap_width"])
  expect(
    traceIds([
      board,
      bend,
      trace("far_along_line", [
        [0, 15],
        [0, 20],
      ]),
      trace(
        "outside_width",
        [
          [halfWidth + 0.2, -4],
          [halfWidth + 0.2, 4],
        ],
        0.1,
      ),
      trace(
        "overlap_width",
        [
          [halfWidth + 0.2, -4],
          [halfWidth + 0.2, 4],
        ],
        0.5,
      ),
    ]),
  ).toEqual(["overlap_width"])
})
