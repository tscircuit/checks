import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbPlatedHole, PcbVia } from "circuit-json"
import { checkViasInPads } from "lib/check-vias-in-pads"
import { checkPadPadClearance } from "lib/check-pad-pad-clearance"
import { makeBoard } from "./check-vias-in-pads-fixtures"

// Polygon pad copper is a 4mm x 4mm square around the drill at (0, 0)
const polygonPadHole: PcbPlatedHole = {
  type: "pcb_plated_hole",
  pcb_plated_hole_id: "pcb_plated_hole_1",
  shape: "hole_with_polygon_pad",
  hole_shape: "circle",
  hole_diameter: 0.8,
  x: 0,
  y: 0,
  hole_offset_x: 0,
  hole_offset_y: 0,
  pad_outline: [
    { x: -2, y: -2 },
    { x: 2, y: -2 },
    { x: 2, y: 2 },
    { x: -2, y: 2 },
  ],
  layers: ["top", "bottom"],
}

// A different-net via sitting on the polygon copper, far from the drill
const viaOnPolygonCopper: PcbVia = {
  type: "pcb_via",
  pcb_via_id: "pcb_via_1",
  x: 1.5,
  y: 1.5,
  hole_diameter: 0.2,
  outer_diameter: 0.4,
  layers: ["top", "bottom"],
}

test("via on polygon-pad copper (not on the drill) is flagged", () => {
  const circuitJson: AnyCircuitElement[] = [
    makeBoard(),
    polygonPadHole,
    viaOnPolygonCopper,
  ]

  const errors = checkViasInPads(circuitJson)
  expect(errors.length).toBeGreaterThan(0)
})

test("pad-pad clearance uses the polygon copper, not the drill circle", () => {
  // An SMT pad overlapping the polygon copper but outside the 0.8mm drill
  const overlappingSmtPad = {
    type: "pcb_smtpad" as const,
    pcb_smtpad_id: "pcb_smtpad_1",
    shape: "rect" as const,
    x: 1.5,
    y: 1.5,
    width: 0.5,
    height: 0.5,
    layer: "top" as const,
    labels: ["net_b"],
  }
  const circuitJson: AnyCircuitElement[] = [
    makeBoard(),
    polygonPadHole,
    overlappingSmtPad,
  ]

  const errors = checkPadPadClearance(circuitJson)
  expect(errors.length).toBeGreaterThan(0)
})
