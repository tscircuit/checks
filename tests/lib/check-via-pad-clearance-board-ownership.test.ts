import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaPadClearance } from "lib/check-via-pad-clearance"

describe("checkViaPadClearance board ownership", () => {
  test("evaluates each board's via-pad pairs against their owning board rule and ignores cross-board pairs", () => {
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
        min_pad_edge_to_pad_edge_clearance: 0.25,
      },
      // Relaxed board: 0.6mm via at x=0 (radius 0.3) and 1x1mm pad at x=0.95 (left edge 0.45 -> 0.15mm gap >= 0.08mm)
      {
        type: "pcb_via",
        pcb_via_id: "via_relaxed",
        subcircuit_id: "subcircuit_relaxed",
        x: 0,
        y: 0,
        outer_diameter: 0.6,
        hole_diameter: 0.3,
        layers: ["top", "bottom"],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_relaxed",
        subcircuit_id: "subcircuit_relaxed",
        shape: "rect",
        x: 0.95,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
      // Cross-board pad near via_relaxed that belongs to board_strict should be ignored
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_other_board",
        subcircuit_id: "subcircuit_strict",
        shape: "rect",
        x: -0.85,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
      // Strict board: 0.6mm via at x=40 (radius 0.3) and 1x1mm pad at x=40.95 (left edge 40.45 -> 0.15mm gap < 0.25mm)
      {
        type: "pcb_via",
        pcb_via_id: "via_strict",
        subcircuit_id: "subcircuit_strict",
        x: 40,
        y: 0,
        outer_diameter: 0.6,
        hole_diameter: 0.3,
        layers: ["top", "bottom"],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_strict",
        subcircuit_id: "subcircuit_strict",
        shape: "rect",
        x: 40.95,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
    ] as unknown as AnyCircuitElement[]

    const errors = checkViaPadClearance(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.pcb_pad_ids).toEqual(["via_strict", "pad_strict"])
    expect(errors[0]!.minimum_clearance).toBeCloseTo(0.25, 6)
    expect(errors[0]!.actual_clearance).toBeCloseTo(0.15, 6)
  })
})
