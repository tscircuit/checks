import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPadPadClearance } from "../../lib/check-pad-pad-clearance"
import { checkPadTraceClearance } from "../../lib/check-pad-trace-clearance"

describe("multi-board pad-to-pad and pad-to-trace clearance ownership", () => {
  test("checkPadPadClearance evaluates each board's pads against their owning board rule", () => {
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
      // Relaxed board: two 1x1mm pads separated by 0.15mm gap (>= 0.08mm required)
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_relaxed_a",
        subcircuit_id: "subcircuit_relaxed",
        shape: "rect",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_relaxed_b",
        subcircuit_id: "subcircuit_relaxed",
        shape: "rect",
        x: 1.15,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
      // Strict board: two 1x1mm pads separated by 0.15mm gap (< 0.25mm required)
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_strict_a",
        subcircuit_id: "subcircuit_strict",
        shape: "rect",
        x: 40,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_strict_b",
        subcircuit_id: "subcircuit_strict",
        shape: "rect",
        x: 41.15,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
    ] as unknown as AnyCircuitElement[]

    const errors = checkPadPadClearance(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.pcb_pad_ids.sort()).toEqual([
      "pad_strict_a",
      "pad_strict_b",
    ])
    expect(errors[0]!.minimum_clearance).toBeCloseTo(0.25, 6)
    expect(errors[0]!.actual_clearance).toBeCloseTo(0.15, 6)
  })

  test("checkPadTraceClearance evaluates each board's pad-trace pairs against their owning board rule", () => {
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
      // Relaxed board: 1x1mm pad at x=0 (right edge x=0.5), 0.2mm trace at x=0.75 (left edge x=0.65 -> 0.15mm gap >= 0.08mm)
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_relaxed",
        subcircuit_id: "subcircuit_relaxed",
        shape: "rect",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_relaxed",
        subcircuit_id: "subcircuit_relaxed",
        route: [
          { route_type: "wire", x: 0.75, y: -1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 0.75, y: 1, width: 0.2, layer: "top" },
        ],
      },
      // Strict board: 1x1mm pad at x=40 (right edge x=40.5), 0.2mm trace at x=40.75 (left edge x=40.65 -> 0.15mm gap < 0.25mm)
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_strict",
        subcircuit_id: "subcircuit_strict",
        shape: "rect",
        x: 40,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_strict",
        subcircuit_id: "subcircuit_strict",
        route: [
          { route_type: "wire", x: 40.75, y: -1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 40.75, y: 1, width: 0.2, layer: "top" },
        ],
      },
    ] as unknown as AnyCircuitElement[]

    const errors = checkPadTraceClearance(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.pcb_pad_id).toBe("pad_strict")
    expect(errors[0]!.pcb_trace_id).toBe("trace_strict")
    expect(errors[0]!.minimum_clearance).toBeCloseTo(0.25, 6)
    expect(errors[0]!.actual_clearance).toBeCloseTo(0.15, 6)
  })
})
