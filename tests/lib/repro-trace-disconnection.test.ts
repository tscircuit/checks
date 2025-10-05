import { test, expect } from "bun:test"
import { runAllChecks } from "../../lib/run-all-checks"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"
import reproTraceDisconnection from "../assets/repro-trace-disconnection.json"

test("repro-trace-disconnection should detect disconnected traces", async () => {
  const errors = await runAllChecks(reproTraceDisconnection as any)

  console.log("Total errors found:", errors.length)

  // Check if there's a trace disconnection error
  const traceErrors = errors.filter((e: any) => e.type === "pcb_trace_error")
  console.log("Trace errors:", traceErrors.length)
  console.log("Trace error details:", JSON.stringify(traceErrors, null, 2))

  // There should be at least one error for the disconnected trace
  expect(errors.length).toBeGreaterThan(0)
  expect(traceErrors.length).toBeGreaterThan(0)
})

test("repro-trace-disconnection - specific check for source_net_1_mst3_0 disconnection", () => {
  const contiguityErrors = checkTracesAreContiguous(
    reproTraceDisconnection as any,
  )

  console.log("Contiguity errors:", contiguityErrors.length)
  console.log(
    "Contiguity error details:",
    JSON.stringify(contiguityErrors, null, 2),
  )

  // Find the specific trace error for source_net_1_mst3_0
  const disconnectedTraceError = contiguityErrors.find(
    (e) => e.pcb_trace_id === "source_net_1_mst3_0",
  )

  console.log("Disconnected trace error found:", !!disconnectedTraceError)

  // This trace should have an error because it doesn't connect to LED_PWR cathode properly
  expect(disconnectedTraceError).toBeDefined()
})
