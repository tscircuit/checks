import { test, expect } from "bun:test"
import type { AnyCircuitElement, PcbPlacementError } from "circuit-json"
import { checkViasOutOfBoard } from "lib/check-pcb-components-out-of-board/checkViasOutOfBoard"

test("no board, should return no errors", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_via",
      pcb_via_id: "via1",
      x: 0,
      y: 0,
      outer_diameter: 0.6,
      hole_diameter: 0.3,
      layers: ["top", "bottom"],
    },
  ]
  const errors = checkViasOutOfBoard(soup)
  expect(errors).toEqual([])
})

test("no vias, should return no errors", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      num_layers: 2,
      thickness: 1.2,
    },
  ]
  const errors = checkViasOutOfBoard(soup)
  expect(errors).toEqual([])
})

test("via completely inside board, should return no errors", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      num_layers: 2,
      thickness: 1.2,
    },
    {
      type: "pcb_via",
      pcb_via_id: "via1",
      x: 0,
      y: 0,
      outer_diameter: 0.6,
      hole_diameter: 0.3,
      layers: ["top", "bottom"],
    },
  ]
  const errors = checkViasOutOfBoard(soup)
  expect(errors).toEqual([])
})

test("via partially outside board (crossing boundary), should return an error", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      num_layers: 2,
      thickness: 1.2,
    },
    {
      type: "pcb_via",
      pcb_via_id: "via_partially_out",
      x: 4.9, // Board edge is at 5.0, via radius is 0.3. So via extends to 5.2
      y: 0,
      outer_diameter: 0.6,
      hole_diameter: 0.3,
      layers: ["top", "bottom"],
    },
  ]
  const errors = checkViasOutOfBoard(soup)
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain(
    "Via pcb_via[#via_partially_out] is outside or crossing the board boundary",
  )
  expect(errors[0].pcb_placement_error_id).toBe(
    "out_of_board_via_partially_out",
  )
})

test("via completely outside board, should return an error", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      num_layers: 2,
      thickness: 1.2,
    },
    {
      type: "pcb_via",
      pcb_via_id: "via_completely_out",
      x: 10, // Board edge is at 5.0
      y: 0,
      outer_diameter: 0.6,
      hole_diameter: 0.3,
      layers: ["top", "bottom"],
    },
  ]
  const errors = checkViasOutOfBoard(soup)
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain(
    "Via pcb_via[#via_completely_out] is outside or crossing the board boundary",
  )
  expect(errors[0].pcb_placement_error_id).toBe(
    "out_of_board_via_completely_out",
  )
})

test("multiple vias, some in, some out", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      num_layers: 2,
      thickness: 1.2,
    },
    {
      // In
      type: "pcb_via",
      pcb_via_id: "via_in",
      x: 0,
      y: 0,
      outer_diameter: 0.6,
      hole_diameter: 0.3,
      layers: ["top", "bottom"],
    },
    {
      // Partially out (top edge)
      type: "pcb_via",
      pcb_via_id: "via_part_out_top",
      x: 0,
      y: 4.9, // Board edge at 5.0, radius 0.3
      outer_diameter: 0.6,
      hole_diameter: 0.3,
      layers: ["top", "bottom"],
    },
    {
      // Completely out (bottom-left)
      type: "pcb_via",
      pcb_via_id: "via_comp_out_bl",
      x: -10,
      y: -10,
      outer_diameter: 0.6,
      hole_diameter: 0.3,
      layers: ["top", "bottom"],
    },
  ]
  const errors = checkViasOutOfBoard(soup)
  expect(errors).toHaveLength(2)
  const errorMessages = errors.map((e) => e.message)
  expect(errorMessages).toContain(
    "Via pcb_via[#via_part_out_top] is outside or crossing the board boundary",
  )
  expect(errorMessages).toContain(
    "Via pcb_via[#via_comp_out_bl] is outside or crossing the board boundary",
  )
})
