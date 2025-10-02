import { describe, expect, test } from "bun:test"
import { checkSourceTracesHavePcbTraces } from "lib/check-source-traces-have-pcb-traces"
import reproTraceDisconnectedJson from "../assets/repro-trace-disconnected.json"

describe("checkSourceTracesHavePcbTraces - real-world autorouting failure", () => {
  test("detects disconnected traces from CH32V003F4P6 circuit autorouting failure", () => {
    // This uses the actual circuit JSON from the user's CH32V003F4P6 circuit with autorouting failures
    // The JSON contains source traces with empty/undefined connected_source_port_ids but no corresponding PCB traces
    const errors = checkSourceTracesHavePcbTraces(
      reproTraceDisconnectedJson as any,
    )

    // Should detect disconnected traces (source traces without corresponding PCB traces)
    expect(errors.length).toBeGreaterThan(0)

    // All errors should be about missing PCB traces
    for (const error of errors) {
      expect(error.type).toBe("pcb_trace_missing_error")
      expect(error.message).toContain("is not connected (it has no PCB trace)")
    }

    // Verify that we're detecting actual source traces from the real circuit
    const sourceTraceIds = errors.map((e) => e.source_trace_id)
    expect(sourceTraceIds.length).toBeGreaterThan(0)

    // Each error should reference a valid source trace ID
    for (const traceId of sourceTraceIds) {
      expect(typeof traceId).toBe("string")
      expect(traceId.length).toBeGreaterThan(0)
    }
  })

  test("shows the fix works - before fix would return 0 errors", () => {
    // This test demonstrates that our fix works by showing the real circuit JSON
    // now properly detects disconnected traces that were previously missed
    const errors = checkSourceTracesHavePcbTraces(
      reproTraceDisconnectedJson as any,
    )

    // Before the fix: 0 errors (bug - disconnected traces were skipped)
    // After the fix: > 0 errors (correct - disconnected traces detected)
    expect(errors.length).toBeGreaterThan(0)

    console.log(
      `✅ Fix working: Found ${errors.length} disconnected traces in real CH32V003F4P6 circuit`,
    )
    console.log(`   Source traces with missing PCB routes:`)
    errors.forEach((err, i) => {
      console.log(`   ${i + 1}. ${err.source_trace_id}: ${err.message}`)
    })
  })
})
