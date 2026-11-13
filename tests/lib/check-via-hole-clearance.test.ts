import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbBoard, PcbHole, PcbVia } from "circuit-json"
import {
  checkViaHoleClearance,
  runAllChecks,
  runAllRoutingChecks,
} from "../../index"

test("via-to-hole clearance detects overlap and clearance across multiple hole shapes", async () => {
  const shapes: PcbHole[] = [
    {
      type: "pcb_hole",
      pcb_hole_id: "hole_circle",
      x: 0,
      y: 0,
      hole_shape: "circle",
      hole_diameter: 2,
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "hole_square",
      x: 0,
      y: 0,
      hole_shape: "square",
      hole_diameter: 2,
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "hole_rect",
      x: 0,
      y: 0,
      hole_shape: "rect",
      hole_width: 2,
      hole_height: 2,
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "hole_oval",
      x: 0,
      y: 0,
      hole_shape: "oval",
      hole_width: 2,
      hole_height: 2,
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "hole_pill",
      x: 0,
      y: 0,
      hole_shape: "pill",
      hole_width: 2,
      hole_height: 2,
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "hole_rot_pill",
      x: 0,
      y: 0,
      hole_shape: "rotated_pill",
      hole_width: 2,
      hole_height: 2,
      ccw_rotation: 90,
    },
  ]

  for (const hole of shapes) {
    // 1. Far via (x = 2.0, hole edge at x = 1.0, via radius = 0.3 -> gap = 0.7mm)
    const clearVia: PcbVia = {
      type: "pcb_via",
      pcb_via_id: "via_clear",
      x: 2.0,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      from_layer: "top",
      to_layer: "bottom",
      layers: ["top", "bottom"],
    }
    expect(checkViaHoleClearance([hole, clearVia])).toHaveLength(0)

    // 2. Clearance violation (x = 1.4 -> gap = 0.1mm, required = 0.2mm)
    const closeVia: PcbVia = {
      type: "pcb_via",
      pcb_via_id: "via_close",
      x: 1.4,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      from_layer: "top",
      to_layer: "bottom",
      layers: ["top", "bottom"],
    }
    const clearanceErrors = checkViaHoleClearance([hole, closeVia])
    expect(clearanceErrors).toHaveLength(1)
    expect(clearanceErrors[0]!.message).toContain(
      "is too close to non-plated hole",
    )
    expect(clearanceErrors[0]!.actual_clearance).toBeCloseTo(0.1, 4)

    // 3. Overlap / accidental contact (x = 0.9 -> cuts into hole edge at x = 1.0)
    const overlapVia: PcbVia = {
      type: "pcb_via",
      pcb_via_id: "via_overlap",
      x: 0.9,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      from_layer: "top",
      to_layer: "bottom",
      layers: ["top", "bottom"],
    }
    const overlapErrors = checkViaHoleClearance([hole, overlapVia])
    expect(overlapErrors).toHaveLength(1)
    expect(overlapErrors[0]!.message).toContain("overlaps with pcb_hole")
    expect(overlapErrors[0]!.message).toContain("(accidental contact)")
    expect(overlapErrors[0]!.actual_clearance).toBeLessThanOrEqual(0)

    // 4. Concentric overlap (x = 0, y = 0)
    const concentricVia: PcbVia = {
      type: "pcb_via",
      pcb_via_id: "via_concentric",
      x: 0,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      from_layer: "top",
      to_layer: "bottom",
      layers: ["top", "bottom"],
    }
    const concentricErrors = checkViaHoleClearance([hole, concentricVia])
    expect(concentricErrors).toHaveLength(1)
    expect(concentricErrors[0]!.message).toContain("overlaps with pcb_hole")
  }
})

test("via-to-hole clearance respects board DRC and custom minClearance", async () => {
  const board: PcbBoard = {
    type: "pcb_board",
    pcb_board_id: "board",
    center: { x: 0, y: 0 },
    width: 10,
    height: 10,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
    min_trace_to_hole_edge_clearance: 0.5,
  }

  const hole: PcbHole = {
    type: "pcb_hole",
    pcb_hole_id: "hole",
    x: 0,
    y: 0,
    hole_shape: "circle",
    hole_diameter: 2,
  }

  // Gap is 1.6 - 1.0 - 0.3 = 0.3mm.
  // Default is 0.2mm (would pass), but board requires 0.5mm (should fail).
  const via: PcbVia = {
    type: "pcb_via",
    pcb_via_id: "via",
    x: 1.6,
    y: 0,
    hole_diameter: 0.3,
    outer_diameter: 0.6,
    from_layer: "top",
    to_layer: "bottom",
    layers: ["top", "bottom"],
  }

  expect(checkViaHoleClearance([hole, via])).toHaveLength(0) // Default 0.2mm passes
  expect(checkViaHoleClearance([board, hole, via])).toHaveLength(1) // Board 0.5mm fails

  // Explicit override minClearance: 0.1mm passes
  expect(
    checkViaHoleClearance([board, hole, via], { minClearance: 0.1 }),
  ).toHaveLength(0)

  // Invalid minClearance throws
  expect(() =>
    checkViaHoleClearance([board, hole, via], { minClearance: -0.1 }),
  ).toThrow("Via-to-hole clearance must be finite and non-negative")
})

test("runAllRoutingChecks and runAllChecks include checkViaHoleClearance", async () => {
  const hole: PcbHole = {
    type: "pcb_hole",
    pcb_hole_id: "hole_1",
    x: 0,
    y: 0,
    hole_shape: "circle",
    hole_diameter: 2,
  }
  const via: PcbVia = {
    type: "pcb_via",
    pcb_via_id: "via_1",
    x: 0.9,
    y: 0,
    hole_diameter: 0.3,
    outer_diameter: 0.6,
    from_layer: "top",
    to_layer: "bottom",
    layers: ["top", "bottom"],
  }

  const routingErrors = await runAllRoutingChecks([hole, via])
  expect(
    routingErrors.some(
      (err) =>
        err.type === "pcb_placement_error" &&
        err.pcb_placement_error_id === "via_hole_clearance_via_1_hole_1",
    ),
  ).toBe(true)

  const allErrors = await runAllChecks([hole, via])
  expect(
    allErrors.some(
      (err) =>
        err.type === "pcb_placement_error" &&
        err.pcb_placement_error_id === "via_hole_clearance_via_1_hole_1",
    ),
  ).toBe(true)
})
