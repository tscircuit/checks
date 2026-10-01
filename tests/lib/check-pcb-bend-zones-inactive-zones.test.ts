import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import {
  board,
  bend,
  via,
  stiffener,
  trace,
  placementIds,
  traceIds,
} from "../fixtures/pcb-bend-zones"
import { checkPcbBendZonePlacement } from "../../index"

test("uses radius and absolute bend angle, ignores zero or degenerate zones, and stays deterministic", () => {
  const circuit: AnyCircuitElement[] = [
    board,
    { ...bend, bend_angle: -90, bend_side: "right", bend_radius: 2 },
    via("wide_zone", 1.4, 0),
  ]
  expect(placementIds(circuit)).toEqual(["bend_zone_bend_wide_zone"])
  expect(checkPcbBendZonePlacement(circuit)).toEqual(
    checkPcbBendZonePlacement(circuit),
  )
  for (const inactive of [
    { ...bend, bend_angle: 0 },
    { ...bend, end: bend.start },
    { ...bend, bend_radius: 0 },
    { ...bend, pcb_board_id: "missing" },
  ]) {
    expect(
      placementIds([board, inactive, via("via", 0, 0), stiffener]),
    ).toEqual([])
    expect(
      traceIds([
        board,
        inactive,
        trace("trace", [
          [0, 0],
          [0, 3],
        ]),
      ]),
    ).toEqual([])
  }
  expect(placementIds([board, via("via", 0, 0)])).toEqual([])
})
