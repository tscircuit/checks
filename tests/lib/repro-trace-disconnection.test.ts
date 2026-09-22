import { test, expect } from "bun:test"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import reproTraceDisconnection from "../assets/repro-trace-disconnection.json"

test("disconnected trace endpoint should be detected with visual snapshot", () => {
  const circuitJson = reproTraceDisconnection as AnyCircuitElement[]
  const errors = checkTracesAreContiguous(circuitJson)

  // Should detect at least one disconnected endpoint
  expect(errors.length).toBeGreaterThanOrEqual(1)

  // Find the specific trace error for source_net_1_mst3_0 (the disconnected trace)
  const disconnectedTraceError = errors.find(
    (e) => e.pcb_trace_id === "source_net_1_mst3_0",
  )

  // This trace should have an error because it has a floating endpoint
  expect(disconnectedTraceError).toBeDefined()
  expect(disconnectedTraceError?.message).toContain("disconnected endpoint")

  // Add errors to circuit JSON for visualization
  circuitJson.push(...errors)

  // Create visual snapshot with error indicators
  expect(
    convertCircuitJsonToPcbSvg(circuitJson, { shouldDrawErrors: true }),
  ).toMatchSvgSnapshot(import.meta.path)
})
