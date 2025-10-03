import { test, expect } from "bun:test"
import { checkTracesStayInsideBoard } from "lib/check-traces-stay-inside-board/check-traces-stay-inside-board"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import tracesOutsideBoardJson from "tests/assets/traces-outside-board.json"

test("traces outside board comprehensive test with visual snapshot", () => {
  const circuitJson = tracesOutsideBoardJson as AnyCircuitElement[]
  const errors = checkTracesStayInsideBoard(circuitJson)

  // Should find multiple traces outside board
  expect(errors.length).toBeGreaterThanOrEqual(3)

  // Verify specific traces are detected
  const traceIds = errors.map((e) => e.pcb_trace_id)
  expect(traceIds).toContain("trace_outside_right")
  expect(traceIds).toContain("trace_outside_top")
  expect(traceIds).toContain("trace_crossing_boundary")

  // Trace inside should not be in errors
  expect(traceIds).not.toContain("trace_inside")

  // Add error markers for visualization
  for (const error of errors) {
    if (error.center) {
      circuitJson.push({
        type: "pcb_silkscreen_text",
        pcb_silkscreen_text_id: `error_${error.pcb_trace_error_id}`,
        pcb_component_id: "error_marker",
        text: "⚠️",
        anchor_position: error.center,
        anchor_alignment: "center",
        font: "tscircuit2024",
        font_size: 0.6,
        layer: "top",
      })
    }
  }

  // Create visual snapshot
  expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )

  console.log(`Found ${errors.length} trace boundary violations:`)
  for (const error of errors) {
    console.log(`- ${error.pcb_trace_id}: ${error.message}`)
  }
})
