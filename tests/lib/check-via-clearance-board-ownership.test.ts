import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkDifferentNetViaSpacing } from "../../lib/check-different-net-via-spacing"
import { checkViaTraceClearance } from "../../lib/check-via-trace-clearance"

describe("multi-board different-net via spacing and via-to-trace clearance ownership", () => {
  test("checkDifferentNetViaSpacing evaluates each board's vias against their owning board rule", () => {
    const circuitJson = [
      {
        type: "pcb_board",
        pcb_board_id: "board_relaxed",
        subcircuit_id: "subcircuit_relaxed",
        center: { x: 0, y: 0 },
        width: 20,
        height: 20,
        material: "fr4",
        num_layers: 2,
        thickness: 1.4,
        min_via_hole_edge_to_via_hole_edge_clearance: 0.15,
        min_pad_edge_to_pad_edge_clearance: 0.08,
      },
      {
        type: "pcb_board",
        pcb_board_id: "board_strict",
        subcircuit_id: "subcircuit_strict",
        center: { x: 40, y: 0 },
        width: 20,
        height: 20,
        material: "fr4",
        num_layers: 2,
        thickness: 1.4,
        min_via_hole_edge_to_via_hole_edge_clearance: 0.35,
        min_pad_edge_to_pad_edge_clearance: 0.25,
      },
      // Relaxed board: two vias with 0.3mm hole, 0.5mm outer, center distance 0.65mm (hole gap 0.35mm >= 0.15mm, copper gap 0.15mm >= 0.08mm)
      {
        type: "pcb_via",
        pcb_via_id: "via_relaxed_a",
        subcircuit_id: "subcircuit_relaxed",
        x: 0,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.5,
        layers: ["top", "bottom"],
      },
      {
        type: "pcb_via",
        pcb_via_id: "via_relaxed_b",
        subcircuit_id: "subcircuit_relaxed",
        x: 0.65,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.5,
        layers: ["top", "bottom"],
      },
      // Strict board: two vias with 0.3mm hole, 0.5mm outer, center distance 0.65mm (hole gap 0.35mm >= 0.35mm, copper gap 0.15mm < 0.25mm)
      {
        type: "pcb_via",
        pcb_via_id: "via_strict_a",
        subcircuit_id: "subcircuit_strict",
        x: 40,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.5,
        layers: ["top", "bottom"],
      },
      {
        type: "pcb_via",
        pcb_via_id: "via_strict_b",
        subcircuit_id: "subcircuit_strict",
        x: 40.65,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.5,
        layers: ["top", "bottom"],
      },
    ] as unknown as AnyCircuitElement[]

    const errors = checkDifferentNetViaSpacing(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.pcb_via_ids.sort()).toEqual([
      "via_strict_a",
      "via_strict_b",
    ])
    expect(errors[0]!.minimum_clearance).toBeCloseTo(0.25, 6)
    expect(errors[0]!.actual_clearance).toBeCloseTo(0.15, 6)
  })

  test("checkViaTraceClearance evaluates each board's via-trace pairs against their owning board rule", () => {
    const circuitJson = [
      {
        type: "pcb_board",
        pcb_board_id: "board_relaxed",
        subcircuit_id: "subcircuit_relaxed",
        center: { x: 0, y: 0 },
        width: 20,
        height: 20,
        material: "fr4",
        num_layers: 2,
        thickness: 1.4,
        min_trace_to_pad_edge_clearance: 0.08,
      },
      {
        type: "pcb_board",
        pcb_board_id: "board_strict",
        subcircuit_id: "subcircuit_strict",
        center: { x: 40, y: 0 },
        width: 20,
        height: 20,
        material: "fr4",
        num_layers: 2,
        thickness: 1.4,
        min_trace_to_pad_edge_clearance: 0.25,
      },
      // Relaxed board: 0.6mm outer via at x=0 (radius 0.3), 0.2mm trace at x=0.55 (left edge x=0.45 -> 0.15mm gap >= 0.08mm)
      {
        type: "pcb_via",
        pcb_via_id: "via_relaxed",
        subcircuit_id: "subcircuit_relaxed",
        x: 0,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_relaxed",
        subcircuit_id: "subcircuit_relaxed",
        route: [
          { route_type: "wire", x: 0.55, y: -1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 0.55, y: 1, width: 0.2, layer: "top" },
        ],
      },
      // Strict board: 0.6mm outer via at x=40 (radius 0.3), 0.2mm trace at x=40.55 (left edge x=40.45 -> 0.15mm gap < 0.25mm)
      {
        type: "pcb_via",
        pcb_via_id: "via_strict",
        subcircuit_id: "subcircuit_strict",
        x: 40,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_strict",
        subcircuit_id: "subcircuit_strict",
        route: [
          { route_type: "wire", x: 40.55, y: -1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 40.55, y: 1, width: 0.2, layer: "top" },
        ],
      },
    ] as unknown as AnyCircuitElement[]

    const errors = checkViaTraceClearance(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.pcb_via_id).toBe("via_strict")
    expect(errors[0]!.pcb_trace_id).toBe("trace_strict")
    expect(errors[0]!.minimum_clearance).toBeCloseTo(0.25, 6)
    expect(errors[0]!.actual_clearance).toBeCloseTo(0.15, 6)
  })
})
