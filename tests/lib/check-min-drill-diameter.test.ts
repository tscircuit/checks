import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkMinDrillDiameter } from "lib/check-min-drill-diameter"
import { runAllChecks } from "lib/run-all-checks"

const board = (extra: Record<string, unknown> = {}): AnyCircuitElement =>
  ({
    type: "pcb_board",
    pcb_board_id: "board1",
    center: { x: 0, y: 0 },
    width: 20,
    height: 20,
    num_layers: 2,
    thickness: 1.2,
    material: "fr4",
    ...extra,
  }) as AnyCircuitElement

const via = (id: string, holeDiameter: number, x = 0): AnyCircuitElement =>
  ({
    type: "pcb_via",
    pcb_via_id: id,
    x,
    y: 0,
    outer_diameter: holeDiameter + 0.2,
    hole_diameter: holeDiameter,
    layers: ["top", "bottom"],
  }) as AnyCircuitElement

test("no holes, should return no errors", () => {
  expect(checkMinDrillDiameter([board()])).toEqual([])
})

test("via with a drill above the minimum, should return no errors", () => {
  expect(checkMinDrillDiameter([board(), via("via_ok", 0.3)])).toEqual([])
})

test("via drill exactly at the minimum, should return no errors", () => {
  expect(checkMinDrillDiameter([board(), via("via_min", 0.2)])).toEqual([])
})

test("via with a drill below the minimum, should return an error", () => {
  const errors = checkMinDrillDiameter([board(), via("via_tiny", 0.1)])
  expect(errors).toHaveLength(1)
  expect(errors[0].type).toBe("pcb_placement_error")
  expect(errors[0].pcb_placement_error_id).toBe(
    "drill_diameter_too_small_via_tiny",
  )
  expect(errors[0].message).toContain("below the minimum drill diameter")
})

test("circular plated hole with a tiny drill, should return an error", () => {
  const soup: AnyCircuitElement[] = [
    board(),
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "ph_tiny",
      shape: "circle",
      x: 0,
      y: 0,
      hole_diameter: 0.1,
      outer_diameter: 0.3,
      layers: ["top", "bottom"],
    } as AnyCircuitElement,
  ]
  const errors = checkMinDrillDiameter(soup)
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_placement_error_id).toBe(
    "drill_diameter_too_small_ph_tiny",
  )
})

test("unplated circular hole with a tiny drill, should return an error", () => {
  const soup: AnyCircuitElement[] = [
    board(),
    {
      type: "pcb_hole",
      pcb_hole_id: "hole_tiny",
      hole_shape: "circle",
      hole_diameter: 0.1,
      x: 0,
      y: 0,
    } as AnyCircuitElement,
  ]
  const errors = checkMinDrillDiameter(soup)
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_placement_error_id).toBe(
    "drill_diameter_too_small_hole_tiny",
  )
})

test("oval plated hole is a milled slot and is out of scope, no error", () => {
  const soup: AnyCircuitElement[] = [
    board(),
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "ph_oval",
      shape: "oval",
      x: 0,
      y: 0,
      hole_width: 0.1,
      hole_height: 0.4,
      outer_width: 0.3,
      outer_height: 0.6,
      layers: ["top", "bottom"],
    } as AnyCircuitElement,
  ]
  expect(checkMinDrillDiameter(soup)).toEqual([])
})

test("a board min_via_hole_diameter override raises the threshold", () => {
  const soup: AnyCircuitElement[] = [
    board({ min_via_hole_diameter: 0.3 }),
    via("via_25", 0.25),
  ]
  // 0.25mm is fine at the 0.2mm default but too small once the board asks for 0.3mm
  expect(checkMinDrillDiameter([board(), via("via_25", 0.25)])).toEqual([])
  const errors = checkMinDrillDiameter(soup)
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_placement_error_id).toBe(
    "drill_diameter_too_small_via_25",
  )
})

test("runAllChecks flags a via drill below the minimum (false negative before)", async () => {
  const soup: AnyCircuitElement[] = [board(), via("via_tiny", 0.1)]
  const errors = await runAllChecks(soup)
  const drillErrors = errors.filter(
    (e) =>
      "pcb_placement_error_id" in e &&
      e.pcb_placement_error_id === "drill_diameter_too_small_via_tiny",
  )
  expect(drillErrors).toHaveLength(1)
})

test("renders snapshot highlighting a via drill below the minimum", () => {
  const soup: AnyCircuitElement[] = [board(), via("via_tiny", 0.1)]
  const errors = checkMinDrillDiameter(soup)
  expect(errors.length).toBeGreaterThan(0)

  const svg = convertCircuitJsonToPcbSvg([...soup, ...errors], {
    shouldDrawErrors: true,
  })

  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
