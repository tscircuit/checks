import { expect, test } from "bun:test"
import { pcb_board, type PcbVia } from "circuit-json"
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
