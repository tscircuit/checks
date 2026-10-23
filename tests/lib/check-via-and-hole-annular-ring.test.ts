import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "lib/check-via-and-hole-annular-ring"
import { runAllChecks, runAllRoutingChecks } from "lib/run-all-checks"

test("valid via and plated hole pass with no errors", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 50,
      height: 50,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_via_hole_diameter: 0.3,
      min_via_pad_diameter: 0.6,
    },
    {
      type: "pcb_via",
      pcb_via_id: "via1",
      x: 5,
      y: 5,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      from_layer: "top",
      to_layer: "bottom",
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "hole1",
      shape: "circle",
      x: 10,
      y: 10,
      hole_diameter: 0.8,
      outer_diameter: 1.4,
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors).toHaveLength(0)
})

test("detects via hole diameter below board minimum", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 50,
      height: 50,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_via_hole_diameter: 0.3,
      min_via_pad_diameter: 0.6,
    },
    {
      type: "pcb_via",
      pcb_via_id: "via_undersized_hole",
      x: 0,
      y: 0,
      hole_diameter: 0.15,
      outer_diameter: 0.6,
      from_layer: "top",
      to_layer: "bottom",
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors.length).toBeGreaterThanOrEqual(1)
  expect(errors[0].message).toContain("hole diameter 0.15mm is below")
})

test("reproduces issue: detects via pad diameter below board minimum and annular ring deficit", () => {
  // From issue #5559:
  // <via pcbX={0} pcbY={-2.5} holeDiameter="0.3mm" outerDiameter="0.35mm"
  //      fromLayer="top" toLayer="bottom" connectsTo=".R1 > .pin1" />
  // Result: a 0.025 mm ring on a board whose min_via_pad_diameter is 0.6
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 50,
      height: 50,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_via_hole_diameter: 0.3,
      min_via_pad_diameter: 0.6,
    },
    {
      type: "pcb_via",
      pcb_via_id: "via_narrow_pad",
      x: 0,
      y: -2.5,
      hole_diameter: 0.3,
      outer_diameter: 0.35,
      from_layer: "top",
      to_layer: "bottom",
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors.length).toBeGreaterThanOrEqual(1)
  const padError = errors.find((e) => e.message.includes("pad diameter 0.35mm"))
  const ringError = errors.find((e) =>
    e.message.includes("annular ring 0.025mm"),
  )
  expect(padError).toBeDefined()
  expect(ringError).toBeDefined()
})

test("detects invalid via where outer diameter <= hole diameter", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_via",
      pcb_via_id: "via_zero_ring",
      x: 0,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.3,
      from_layer: "top",
      to_layer: "bottom",
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors.length).toBeGreaterThanOrEqual(1)
  expect(
    errors.some((e) =>
      e.message.includes("must be greater than hole diameter"),
    ),
  ).toBe(true)
})

test("detects plated hole with annular ring below minimum", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pth_narrow_ring",
      shape: "circle",
      x: 0,
      y: 0,
      hole_diameter: 0.8,
      outer_diameter: 0.9, // ring is 0.05mm, below 0.15mm min
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors.length).toBe(1)
  expect(errors[0].message).toContain(
    "Plated hole annular ring 0.050mm is below the minimum",
  )
})

test("detects oval/pill plated hole with annular ring below minimum", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pth_oval",
      shape: "pill",
      x: 0,
      y: 0,
      hole_width: 0.6,
      hole_height: 1.6,
      outer_width: 0.7, // ringX = 0.05mm, below 0.15mm min
      outer_height: 2.0,
      ccw_rotation: 0,
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors.length).toBe(1)
  expect(errors[0].message).toContain(
    "Plated hole annular ring 0.050mm is below the minimum",
  )
})

test("detects circular hole with rect pad annular ring below minimum", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pth_rect_pad",
      shape: "circular_hole_with_rect_pad",
      hole_shape: "circle",
      pad_shape: "rect",
      hole_offset_x: 0,
      hole_offset_y: 0,
      x: 0,
      y: 0,
      hole_diameter: 0.8,
      rect_pad_width: 0.9, // ringX = 0.05mm
      rect_pad_height: 1.4,
      layers: ["top", "bottom"],
    },
  ]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors.length).toBe(1)
  expect(errors[0].message).toContain(
    "Plated hole annular ring 0.050mm is below the minimum",
  )
})

test("detects trace route-point via violations", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 50,
      height: 50,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_via_hole_diameter: 0.3,
      min_via_pad_diameter: 0.6,
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
        {
          route_type: "via",
          x: 2,
          y: 2,
          from_layer: "top",
          to_layer: "bottom",
          hole_diameter: 0.3,
          outer_diameter: 0.35,
        },
        { route_type: "wire", x: 4, y: 4, width: 0.2, layer: "bottom" },
      ],
    },
  ]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors.length).toBeGreaterThanOrEqual(1)
  expect(errors.some((e) => e.message.includes("trace trace1"))).toBe(true)
})

test("is included in runAllRoutingChecks and runAllChecks", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 50,
      height: 50,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_via_hole_diameter: 0.3,
      min_via_pad_diameter: 0.6,
    },
    {
      type: "pcb_via",
      pcb_via_id: "via_bad",
      x: 0,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.35,
      from_layer: "top",
      to_layer: "bottom",
      layers: ["top", "bottom"],
    },
  ]

  const routingErrors = await runAllRoutingChecks(circuitJson)
  expect(
    routingErrors.some((e) => e.message.includes("pad diameter 0.35mm")),
  ).toBe(true)

  const allErrors = await runAllChecks(circuitJson)
  expect(allErrors.some((e) => e.message.includes("pad diameter 0.35mm"))).toBe(
    true,
  )
})
