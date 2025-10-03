import { test, expect } from "bun:test"
import { checkPcbTracesOutOfBoard } from "lib/check-trace-out-of-board/checkTraceOutOfBoard"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import uShapedBoardJson from "tests/assets/traces-u-shaped-board.json"

test("U-shaped board: trace crossing gap should be detected", () => {
  const circuitJson = uShapedBoardJson as AnyCircuitElement[]
  const errors = checkPcbTracesOutOfBoard(circuitJson)

  // Should find the trace that crosses through the U-shaped gap
  expect(errors.length).toBeGreaterThanOrEqual(1)

  // Verify the bad trace is detected
  const traceIds = errors.map((e) => e.pcb_trace_id)
  expect(traceIds).toContain("trace_bad_crosses_gap")

  // Good traces should not be in errors
  expect(traceIds).not.toContain("trace_good_left")
  expect(traceIds).not.toContain("trace_good_right")

  // Add error markers for visualization
  for (const error of errors) {
    if (error.center) {
      circuitJson.push({
        type: "pcb_silkscreen_text",
        pcb_silkscreen_text_id: `error_${error.pcb_trace_error_id}`,
        pcb_component_id: "error_marker",
        text: "❌",
        anchor_position: error.center,
        anchor_alignment: "center",
        font: "tscircuit2024",
        font_size: 0.6,
        layer: "top",
      })
    }
  }

  // Create visual snapshot showing U-shaped board with error
  expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
