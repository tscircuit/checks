import { expect, test, describe } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import traces4 from "tests/assets/traces4.solution.json"

describe("checkEachPcbTraceNonOverlapping", () => {
  test("traces4 should have no trace overlap errors", () => {
    const errors = checkEachPcbTraceNonOverlapping(traces4 as any)
    expect(errors).toHaveLength(0)
  })
})
