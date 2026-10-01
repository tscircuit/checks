import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbStiffener } from "circuit-json"
import {
  board,
  bend,
  via,
  pad,
  stiffener,
  trace,
  placementIds,
  traceIds,
} from "../fixtures/pcb-bend-zones"

test("translates board-local bends and stiffeners and honors stiffener rotation and polygons", () => {
  const translatedBoard = { ...board, center: { x: 20, y: 40 } }
  const rotated: PcbStiffener = {
    ...stiffener,
    pcb_stiffener_id: "rotated",
    center: { x: 1.2, y: 0 },
    width: 0.2,
    height: 2,
    rotation: 90,
  }
  const polygon: PcbStiffener = {
    type: "pcb_stiffener",
    pcb_stiffener_id: "polygon",
    pcb_board_id: "board",
    shape: "polygon",
    outline: [
      { x: 0, y: 5 },
      { x: 2, y: 5 },
      { x: 2, y: 6 },
    ],
    layer: "top",
    material: "fr4",
    thickness: 0.2,
  }
  const circuit: AnyCircuitElement[] = [
    translatedBoard,
    bend,
    rotated,
    polygon,
    { ...rotated, pcb_stiffener_id: "unrotated", rotation: 0 },
    { ...stiffener, pcb_stiffener_id: "foreign", pcb_board_id: "other_board" },
    via("world", 20, 44),
    via("origin", 0, 4),
    pad("world_pad", 20, 36),
    trace("world_trace", [
      [20, 40],
      [20, 43],
    ]),
    trace("origin_trace", [
      [0, 0],
      [0, 3],
    ]),
  ]
  expect(placementIds(circuit).sort()).toEqual([
    "bend_zone_bend_polygon",
    "bend_zone_bend_rotated",
    "bend_zone_bend_world",
    "bend_zone_bend_world_pad",
  ])
  expect(traceIds(circuit)).toEqual(["world_trace"])
})
