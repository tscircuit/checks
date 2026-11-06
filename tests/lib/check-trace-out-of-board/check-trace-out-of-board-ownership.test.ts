import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbTracesOutOfBoard } from "lib/check-trace-out-of-board/checkTraceOutOfBoard"

describe("checkPcbTracesOutOfBoard board ownership", () => {
  test("evaluates each trace against its owning board outline and clearance margin", () => {
    const circuitJson = [
      {
        type: "pcb_board",
        pcb_board_id: "board_left",
        subcircuit_id: "subcircuit_left",
        center: { x: 0, y: 0 },
        width: 10,
        height: 10,
        material: "fr4",
        num_layers: 2,
        thickness: 1.4,
        min_board_edge_clearance: 0.1,
      },
      {
        type: "pcb_board",
        pcb_board_id: "board_right",
        subcircuit_id: "subcircuit_right",
        center: { x: 40, y: 0 },
        width: 10,
        height: 10,
        material: "fr4",
        num_layers: 2,
        thickness: 1.4,
        min_board_edge_clearance: 0.5,
      },
      // Left board (x in [-5, 5], margin 0.1mm): trace at x = 4.75 has 0.25mm center-to-edge distance >= 0.1 + 0.1 = 0.2mm required
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_left_ok",
        subcircuit_id: "subcircuit_left",
        route: [
          { route_type: "wire", x: 4.75, y: -2, width: 0.2, layer: "top" },
          { route_type: "wire", x: 4.75, y: 2, width: 0.2, layer: "top" },
        ],
      },
      // Right board (x in [35, 45], margin 0.5mm): trace at x = 40 is well inside board_right (5mm from edge)
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_right_inside",
        subcircuit_id: "subcircuit_right",
        route: [
          { route_type: "wire", x: 40, y: -2, width: 0.2, layer: "top" },
          { route_type: "wire", x: 40, y: 2, width: 0.2, layer: "top" },
        ],
      },
      // Right board (x in [35, 45], margin 0.5mm): trace at x = 44.75 has 0.25mm center-to-edge distance < 0.1 + 0.5 = 0.6mm required
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_right_too_close",
        subcircuit_id: "subcircuit_right",
        route: [
          { route_type: "wire", x: 44.75, y: -2, width: 0.2, layer: "top" },
          { route_type: "wire", x: 44.75, y: 2, width: 0.2, layer: "top" },
        ],
      },
    ] as unknown as AnyCircuitElement[]

    const errors = checkPcbTracesOutOfBoard(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.pcb_trace_id).toBe("trace_right_too_close")
  })
})
