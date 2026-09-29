import { expect, test } from "bun:test"
import type { PcbSmtPad } from "circuit-json"
import { checkViasInPads } from "lib/check-vias-in-pads"
import { getPadToPadGap } from "lib/check-pad-clearance/common"
import { makeBoard, rectPad, viaInRectPad } from "./check-vias-in-pads-fixtures"

test.each([
  { position: "fully enclosed", x: 0.3, errors: 1 },
  { position: "hole enclosed, copper protruding", x: 0.4, errors: 1 },
  { position: "center on edge", x: 0.5, errors: 1 },
  { position: "hole crosses edge by 0.0001mm", x: 0.5999, errors: 1 },
  { position: "hole externally tangent", x: 0.6, errors: 0 },
  { position: "hole outside by 0.0001mm", x: 0.6001, errors: 0 },
  { position: "copper externally tangent", x: 0.7, errors: 0 },
  { position: "separated", x: 0.8, errors: 0 },
])("via-in-pad boundary: $position", ({ x, errors }) => {
  const via = { ...viaInRectPad, x, y: 0 }
  expect(checkViasInPads([makeBoard(false), rectPad, via])).toHaveLength(errors)
})

const copperOnlyCases: Array<{
  shape: string
  pad: PcbSmtPad
  viaCenter: { x: number; y: number }
}> = [
  {
    shape: "circle",
    pad: { ...rectPad, shape: "circle", radius: 0.5 },
    viaCenter: { x: 0.65, y: 0 },
  },
  {
    shape: "rounded rectangle corner",
    pad: { ...rectPad, corner_radius: 0.3 },
    viaCenter: { x: 0.49, y: 0.49 },
  },
  {
    shape: "rotated rectangle",
    pad: { ...rectPad, shape: "rotated_rect", height: 0.5, ccw_rotation: 45 },
    viaCenter: { x: 0.65 / Math.SQRT2, y: 0.65 / Math.SQRT2 },
  },
  {
    shape: "pill",
    pad: { ...rectPad, shape: "pill", width: 1.4, height: 0.6, radius: 0.3 },
    viaCenter: { x: 0.85, y: 0 },
  },
  {
    shape: "rotated pill",
    pad: {
      ...rectPad,
      shape: "rotated_pill",
      width: 1.4,
      height: 0.6,
      radius: 0.3,
      ccw_rotation: 45,
    },
    viaCenter: { x: 0.85 / Math.SQRT2, y: 0.85 / Math.SQRT2 },
  },
  {
    shape: "polygon",
    pad: {
      type: "pcb_smtpad",
      pcb_smtpad_id: "polygon_pad",
      shape: "polygon",
      layer: "top",
      points: [
        { x: -0.5, y: -0.5 },
        { x: 0.5, y: -0.5 },
        { x: 0, y: 0.5 },
      ],
    },
    viaCenter: { x: 0, y: -0.65 },
  },
]

test.each(copperOnlyCases)(
  "ignores copper-only contact at a $shape edge",
  ({ pad, viaCenter }) => {
    const via = { ...viaInRectPad, ...viaCenter }
    expect(getPadToPadGap(via, pad)).toBeLessThanOrEqual(0)
    expect(checkViasInPads([makeBoard(false), pad, via])).toEqual([])
  },
)
