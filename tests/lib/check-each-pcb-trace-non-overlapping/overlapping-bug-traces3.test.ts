import { describe, expect, test } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkPadTraceClearance } from "lib/check-pad-trace-clearance"
import traces3 from "tests/assets/traces3.solution.json"

describe("checkEachPcbTraceNonOverlapping", () => {
  test("classifies trace-pad overlap and clearance separately", () => {
    const overlapErrors = checkEachPcbTraceNonOverlapping(traces3 as any)
    const clearanceErrors = checkPadTraceClearance(traces3 as any)

    expect(overlapErrors).toHaveLength(1)
    expect(clearanceErrors).toHaveLength(1)
  })
})
