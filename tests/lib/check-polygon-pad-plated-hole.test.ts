import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbPlatedHole, PcbVia } from "circuit-json"
import { checkPadPadClearance } from "lib/check-pad-pad-clearance"
import { checkPadTraceClearance } from "lib/check-pad-trace-clearance"
import { checkViaPadClearance } from "lib/check-via-pad-clearance"
import { checkViasInPads } from "lib/check-vias-in-pads"
import { makeBoard } from "./check-vias-in-pads-fixtures"

// 4mm x 4mm square copper pad (outline is relative to the hole center)
const polygonPadHole: PcbPlatedHole = {
  type: "pcb_plated_hole",
  pcb_plated_hole_id: "pcb_plated_hole_1",
  shape: "hole_with_polygon_pad",
  hole_shape: "circle",
  hole_diameter: 0.8,
  pad_outline: [
    { x: -2, y: -2 },
    { x: 2, y: -2 },
    { x: 2, y: 2 },
    { x: -2, y: 2 },
  ],
  hole_offset_x: 0,
  hole_offset_y: 0,
  x: 0,
  y: 0,
  layers: ["top", "bottom"],
}

// Via copper fully inside the polygon pad, far from the drill
const viaOnPadCopper: PcbVia = {
  type: "pcb_via",
  pcb_via_id: "pcb_via_1",
  x: 1.5,
  y: 1.5,
  outer_diameter: 0.6,
  hole_diameter: 0.3,
  layers: ["top", "bottom"],
}

test("checkViasInPads reports a via on the copper of a polygon-pad plated hole", () => {
  const circuitJson: AnyCircuitElement[] = [
    makeBoard(),
    polygonPadHole,
    viaOnPadCopper,
  ]
  const errors = checkViasInPads(circuitJson)
  expect(errors).toHaveLength(1)
})

test("checkViaPadClearance reports a via 0.05mm from a polygon-pad plated hole", () => {
  const via: PcbVia = { ...viaOnPadCopper, x: 2.35, y: 0 } // copper edge at 2.05 -> 0.05mm gap
  const errors = checkViaPadClearance([makeBoard(), polygonPadHole, via])
  expect(errors).toHaveLength(1)
})

test("checkPadPadClearance reports an SMT pad overlapping a polygon-pad plated hole", () => {
  const circuitJson: AnyCircuitElement[] = [
    makeBoard(),
    polygonPadHole,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_1",
      shape: "rect",
      x: 1.5,
      y: -1.5,
      width: 0.6,
      height: 0.6,
      layer: "top",
    },
  ]
  const errors = checkPadPadClearance(circuitJson)
  expect(errors).toHaveLength(1)
})

test("rotated polygon pad: via on copper only reachable through the rotation is reported", () => {
  // 6mm x 1mm bar rotated 90deg -> spans y in [-3, 3]
  const bar: PcbPlatedHole = {
    ...polygonPadHole,
    pcb_plated_hole_id: "pcb_plated_hole_2",
    pad_outline: [
      { x: -3, y: -0.5 },
      { x: 3, y: -0.5 },
      { x: 3, y: 0.5 },
      { x: -3, y: 0.5 },
    ],
    ccw_rotation: 90,
  }
  const via: PcbVia = { ...viaOnPadCopper, x: 0, y: 2.5 }
  expect(checkViasInPads([makeBoard(), bar, via])).toHaveLength(1)
  const viaUnrotatedPosition: PcbVia = { ...viaOnPadCopper, x: 2.5, y: 0 }
  expect(
    checkViasInPads([makeBoard(), bar, viaUnrotatedPosition]),
  ).toHaveLength(0)
})

test("checkPadTraceClearance reports a trace 0.05mm from the copper of a polygon-pad plated hole", () => {
  const circuitJson: AnyCircuitElement[] = [
    makeBoard(),
    polygonPadHole,
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_1",
      route: [
        // 0.2mm wide trace whose lower edge sits at y=2.05, pad copper ends at y=2
        { route_type: "wire", x: -5, y: 2.15, width: 0.2, layer: "top" },
        { route_type: "wire", x: 5, y: 2.15, width: 0.2, layer: "top" },
      ],
    },
  ]
  const errors = checkPadTraceClearance(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].actual_clearance).toBeCloseTo(0.05, 6)
})
