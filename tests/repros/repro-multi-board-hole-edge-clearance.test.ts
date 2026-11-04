import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { PcbBoard, PcbHole, PcbTrace } from "circuit-json"
import { checkHoleTraceClearance } from "lib/check-hole-trace-clearance"

test("repro: the first board's hole clearance overrides the second board's rule", () => {
  const left: PcbBoard = {
    type: "pcb_board",
    pcb_board_id: "left",
    subcircuit_id: "left_subcircuit",
    center: { x: -10, y: 0 },
    width: 10,
    height: 10,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
    min_trace_to_hole_edge_clearance: 0.2,
  }
  const right: PcbBoard = {
    ...left,
    pcb_board_id: "right",
    subcircuit_id: "right_subcircuit",
    center: { x: 10, y: 0 },
    min_trace_to_hole_edge_clearance: 0.5,
  }
  const hole: PcbHole = {
    type: "pcb_hole",
    pcb_hole_id: "right_hole",
    subcircuit_id: "right_subcircuit",
    hole_shape: "circle",
    hole_diameter: 1,
    x: 10,
    y: 0,
  }
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "right_trace",
    subcircuit_id: "right_subcircuit",
    route: [
      { route_type: "wire", x: 9, y: 0.9, layer: "top", width: 0.2 },
      { route_type: "wire", x: 11, y: 0.9, layer: "top", width: 0.2 },
    ],
  }

  // Copper-to-hole-edge gap: 0.9 - 0.1 - 0.5 = 0.3 mm.
  const control = checkHoleTraceClearance([right, hole, trace])
  expect(control).toHaveLength(1)
  expect(control[0].message).toContain("gap: 0.300000mm, required: 0.5mm")

  const circuitJson = [left, right, hole, trace]
  const errors = checkHoleTraceClearance(circuitJson)
  // Current bug: adding the 0.2 mm left board hides the right-board violation.
  // After the fix, both board orders should report the same violation.
  expect(errors).toEqual([])
  expect(checkHoleTraceClearance([right, left, hole, trace])).toHaveLength(1)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
