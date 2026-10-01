import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import {
  board,
  bend,
  via,
  pad,
  trace,
  placementIds,
  traceIds,
} from "../fixtures/pcb-bend-zones"

test("does not compare copper from another board and resolves nested subcircuit ownership", () => {
  const circuit: AnyCircuitElement[] = [
    { ...board, subcircuit_id: "board_subcircuit" },
    bend,
    {
      ...board,
      pcb_board_id: "other_board",
      subcircuit_id: "other_subcircuit",
    },
    {
      type: "source_group",
      source_group_id: "child_group",
      is_subcircuit: true,
      subcircuit_id: "child",
      parent_subcircuit_id: "board_subcircuit",
    },
    {
      type: "source_group",
      source_group_id: "foreign_group",
      is_subcircuit: true,
      subcircuit_id: "foreign_child",
      parent_subcircuit_id: "other_subcircuit",
    },
    { ...via("nested", 0, 0), subcircuit_id: "child" },
    { ...pad("foreign_pad", 0, 2), subcircuit_id: "foreign_child" },
    { ...via("foreign_via", 0, 4), subcircuit_id: "other_subcircuit" },
    {
      type: "pcb_component",
      pcb_component_id: "foreign_component",
      source_component_id: "source_component",
      positioned_relative_to_pcb_board_id: "other_board",
      center: { x: 0, y: 0 },
      layer: "top",
      rotation: 0,
      width: 0.5,
      height: 0.5,
      obstructs_within_bounds: false,
    },
    {
      ...pad("foreign_component_pad", 0, 0),
      pcb_component_id: "foreign_component",
    },
    {
      ...trace("nested_trace", [
        [0, 5],
        [0, 6],
      ]),
      subcircuit_id: "child",
    },
    {
      ...trace("foreign_trace", [
        [0, 5],
        [0, 6],
      ]),
      subcircuit_id: "foreign_child",
    },
  ]
  expect(placementIds(circuit)).toEqual(["bend_zone_bend_nested"])
  expect(traceIds(circuit)).toEqual(["nested_trace"])
})
