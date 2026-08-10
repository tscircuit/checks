import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkPadsOffBoard } from "lib/check-pcb-components-out-of-board/checkPadsOffBoard"
import { runAllChecks } from "lib/run-all-checks"

const board = (): AnyCircuitElement => ({
  type: "pcb_board",
  pcb_board_id: "board1",
  center: { x: 0, y: 0 },
  width: 10,
  height: 10,
  num_layers: 2,
  thickness: 1.2,
  material: "fr4",
  min_board_edge_clearance: 0.2,
})

test("no board, should return no errors", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "rect",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
  ]
  expect(checkPadsOffBoard(soup)).toEqual([])
})

test("no pads, should return no errors", () => {
  expect(checkPadsOffBoard([board()])).toEqual([])
})

test("pad well inside the board, should return no errors", () => {
  const soup: AnyCircuitElement[] = [
    board(),
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_inside",
      shape: "rect",
      x: 4.2, // max_x = 4.7, i.e. 0.3mm from the edge (>= 0.2mm clearance)
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
  ]
  expect(checkPadsOffBoard(soup)).toEqual([])
})

test("smt pad copper in the board-edge clearance band, should return an error", () => {
  const soup: AnyCircuitElement[] = [
    board(),
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_too_close",
      shape: "rect",
      x: 4.6, // max_x = 4.85, only 0.15mm from the edge at 5.0 (< 0.2mm)
      y: 0,
      width: 0.5,
      height: 1,
      layer: "top",
    },
  ]
  const errors = checkPadsOffBoard(soup)
  expect(errors).toHaveLength(1)
  expect(errors[0].type).toBe("pcb_placement_error")
  expect(errors[0].pcb_placement_error_id).toBe("pad_off_board_pad_too_close")
  expect(errors[0].message).toContain(
    "is too close to or crossing the board edge",
  )
})

test("smt pad crossing the board edge, should return an error", () => {
  const soup: AnyCircuitElement[] = [
    board(),
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_crossing",
      shape: "rect",
      x: 5, // straddles the edge at x = 5.0
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
  ]
  const errors = checkPadsOffBoard(soup)
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_placement_error_id).toBe("pad_off_board_pad_crossing")
})

test("plated hole in the board-edge clearance band, should return an error", () => {
  const soup: AnyCircuitElement[] = [
    board(),
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "ph_too_close",
      shape: "circle",
      x: 4.75, // outer copper reaches x = 5.05, past the edge
      y: 0,
      hole_diameter: 0.4,
      outer_diameter: 0.6,
      layers: ["top", "bottom"],
    } as AnyCircuitElement,
  ]
  const errors = checkPadsOffBoard(soup)
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_placement_error_id).toBe("pad_off_board_ph_too_close")
})

test("runAllChecks flags a pad in the clearance band while the component stays inside the board", async () => {
  // The component bounding box is fully inside the board, so
  // checkPcbComponentsOutOfBoard stays silent, yet pad2 copper is only 0.15mm
  // from the edge. Before checkPadsOffBoard this passed clean (false negative).
  const soup: AnyCircuitElement[] = [
    board(),
    {
      type: "pcb_component",
      pcb_component_id: "R1",
      center: { x: 4.0, y: 0 },
      width: 1.7,
      height: 1.2,
      layer: "top",
      rotation: 0,
    } as AnyCircuitElement,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      pcb_component_id: "R1",
      shape: "rect",
      x: 3.4,
      y: 0,
      width: 0.5,
      height: 1.2,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad2",
      pcb_component_id: "R1",
      shape: "rect",
      x: 4.6, // max_x = 4.85, only 0.15mm from the board edge
      y: 0,
      width: 0.5,
      height: 1.2,
      layer: "top",
    },
  ]

  const errors = await runAllChecks(soup)
  const padEdgeErrors = errors.filter(
    (e) =>
      "pcb_placement_error_id" in e &&
      e.pcb_placement_error_id === "pad_off_board_pad2",
  )
  expect(padEdgeErrors).toHaveLength(1)
})

test("renders snapshot highlighting a pad too close to the board edge", () => {
  const soup: AnyCircuitElement[] = [
    board(),
    {
      type: "pcb_component",
      pcb_component_id: "R1",
      center: { x: 4.0, y: 0 },
      width: 1.7,
      height: 1.2,
      layer: "top",
      rotation: 0,
    } as AnyCircuitElement,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      pcb_component_id: "R1",
      shape: "rect",
      x: 3.4,
      y: 0,
      width: 0.5,
      height: 1.2,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad2",
      pcb_component_id: "R1",
      shape: "rect",
      x: 4.6,
      y: 0,
      width: 0.5,
      height: 1.2,
      layer: "top",
    },
  ]

  const errors = checkPadsOffBoard(soup)
  expect(errors.length).toBeGreaterThan(0)

  const svg = convertCircuitJsonToPcbSvg([...soup, ...errors], {
    shouldDrawErrors: true,
  })

  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
