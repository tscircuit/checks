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

test("uses the true outline for diagonal bends and rotated or polygon pads", () => {
  const diagonalBend = { ...bend, start: { x: -5, y: -5 }, end: { x: 5, y: 5 } }
  expect(
    placementIds([
      board,
      diagonalBend,
      via("inside", 2, 2),
      via("aabb_only", -4, 4),
      {
        ...pad("rotated_pad", 2.8, 1.2),
        shape: "rotated_rect",
        width: 3,
        height: 0.2,
        ccw_rotation: 135,
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "polygon_pad",
        shape: "polygon",
        layer: "bottom",
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0 },
          { x: 0.5, y: 0.5 },
        ],
      },
    ]).sort(),
  ).toEqual([
    "bend_zone_bend_inside",
    "bend_zone_bend_polygon_pad",
    "bend_zone_bend_rotated_pad",
  ])
  expect(
    traceIds([
      board,
      diagonalBend,
      trace("perpendicular", [
        [-2, 2],
        [0, 0],
        [2, -2],
      ]),
      trace("parallel", [
        [-2, -2],
        [2, 2],
      ]),
      trace("diagonal", [
        [-2, 0],
        [2, 0],
      ]),
    ]),
  ).toEqual(["parallel", "diagonal"])
})
