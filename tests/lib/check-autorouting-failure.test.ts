import { expect, test } from "bun:test"
import { checkSourceTracesHavePcbTraces } from "lib/check-source-traces-have-pcb-traces"
import reproTraceDisconnectedJson from "../assets/repro-trace-disconnected.json"

test("detects disconnected traces from CH32V003F4P6 circuit autorouting failure", () => {
  // This uses the actual circuit JSON from the user's CH32V003F4P6 circuit with autorouting failures
  // The JSON contains source traces with empty/undefined connected_source_port_ids but no corresponding PCB traces
  const errors = checkSourceTracesHavePcbTraces(
    reproTraceDisconnectedJson as any,
  )

  // Before the fix: 0 errors (bug - disconnected traces were skipped)
  // After the fix: 10 errors (correct - all disconnected traces detected)
  expect(errors.length).toBe(10)

  // All should be PCB trace missing errors
  errors.forEach((error) => {
    expect(error.type).toBe("pcb_trace_missing_error")
    expect(error.message).toContain("is not connected (it has no PCB trace)")
  })
})
