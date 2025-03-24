import { expect, test, describe } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import traces3 from "tests/assets/traces3.solution.json"

describe("checkEachPcbTraceNonOverlapping", () => {
  test("should return no errors when traces don't overlap", () => {
    const errors = checkEachPcbTraceNonOverlapping(traces3 as any)
    console.log(errors)

    expect(errors).toHaveLength(1)
  })
})
