import { expect, test } from "bun:test"
import { type PcbVia, pcb_board } from "circuit-json"
import { checkDifferentNetViaSpacing } from "lib/check-different-net-via-spacing"

const viaA: PcbVia = {
  type: "pcb_via",
  pcb_via_id: "via_a",
  source_net_id: "net_a",
  x: 0,
  y: 0,
  outer_diameter: 0.4,
  hole_diameter: 0.2,
  layers: ["top", "bottom"],
}
const viaB: PcbVia = {
  ...viaA,
  pcb_via_id: "via_b",
  source_net_id: "net_b",
  x: 0.45,
}

test("reports positive copper clearance below the pad clearance requirement", () => {
  const errors = checkDifferentNetViaSpacing([viaA, viaB])
  expect(errors).toHaveLength(1)
  expect(errors[0].actual_clearance).toBeCloseTo(0.05)
  expect(errors[0].minimum_clearance).toBe(0.1)
})

test("accepts copper clearance at the required minimum", () => {
  const errors = checkDifferentNetViaSpacing([viaA, { ...viaB, x: 0.5 }])
  expect(errors).toHaveLength(0)
})

test("uses the board pad clearance for via copper", () => {
  const board = pcb_board.parse({
    type: "pcb_board",
    center: { x: 0, y: 0 },
    width: 10,
    height: 10,
    min_pad_edge_to_pad_edge_clearance: 0.2,
  })
  const errors = checkDifferentNetViaSpacing([
    board,
    viaA,
    { ...viaB, x: 0.55 },
  ])
  expect(errors).toHaveLength(1)
  expect(errors[0].actual_clearance).toBeCloseTo(0.15)
  expect(errors[0].minimum_clearance).toBe(0.2)
})

test("retains the drill clearance override when copper clearance passes", () => {
  const errors = checkDifferentNetViaSpacing([viaA, { ...viaB, x: 0.55 }], {
    minClearance: 0.4,
  })
  expect(errors).toHaveLength(1)
  expect(errors[0].actual_clearance).toBeCloseTo(0.35)
  expect(errors[0].minimum_clearance).toBe(0.4)
})

test("does not report copper overlap on separate copper layers", () => {
  const errors = checkDifferentNetViaSpacing([
    { ...viaA, layers: ["top", "inner1"] },
    { ...viaB, x: 0.398, layers: ["inner2", "bottom"] },
  ])
  expect(errors).toHaveLength(0)
})

test("does not report drill or copper clearance for coaxial blind vias on disjoint layer spans", () => {
  const errors = checkDifferentNetViaSpacing([
    { ...viaA, x: 0, layers: ["top", "inner1"] },
    { ...viaB, x: 0, layers: ["inner2", "bottom"] },
  ])
  expect(errors).toHaveLength(0)
})

test("reports clearance when an endpoint-only through-via span crosses a buried via span", () => {
  const errors = checkDifferentNetViaSpacing([
    { ...viaA, x: 0, layers: ["top", "bottom"] },
    { ...viaB, x: 0.45, layers: ["inner1", "inner2"] },
  ])
  expect(errors).toHaveLength(1)
  expect(errors[0].actual_clearance).toBeCloseTo(0.05)
})

test("checks drill clearance for backdrilled through-hole vias without flagging removed inner copper pads", () => {
  const drillErrors = checkDifferentNetViaSpacing([
    { ...viaA, x: 0, through_hole: true, layers: ["top", "inner1"] },
    { ...viaB, x: 0.25, layers: ["inner2", "bottom"] },
  ])
  expect(drillErrors).toHaveLength(1)

  const copperOnly = checkDifferentNetViaSpacing([
    { ...viaA, x: 0, through_hole: true, layers: ["top", "inner1"] },
    { ...viaB, x: 0.45, layers: ["inner2", "bottom"] },
  ])
  expect(copperOnly).toHaveLength(0)
})

test("does not report same-net copper overlap", () => {
  const errors = checkDifferentNetViaSpacing([
    viaA,
    { ...viaB, x: 0.398, source_net_id: viaA.source_net_id },
  ])
  expect(errors).toHaveLength(0)
})

test("reports a small copper overlap even with zero required clearance", () => {
  const board = pcb_board.parse({
    type: "pcb_board",
    center: { x: 0, y: 0 },
    width: 10,
    height: 10,
    min_pad_edge_to_pad_edge_clearance: 0,
  })
  const errors = checkDifferentNetViaSpacing([
    board,
    viaA,
    { ...viaB, x: 0.398 },
  ])
  expect(errors).toHaveLength(1)
  expect(errors[0].actual_clearance).toBeCloseTo(-0.002)
  expect(errors[0].minimum_clearance).toBe(0)
})
