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

  // Add errors to circuit JSON for visualization
  circuitJson.push(...errors)

  // Create visual snapshot showing U-shaped board with error
  expect(
    convertCircuitJsonToPcbSvg(circuitJson, { shouldDrawErrors: true }),
  ).toMatchSvgSnapshot(import.meta.path)
})
