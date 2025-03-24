import { expect, test, describe } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import type { AnyCircuitElement } from "circuit-json"
import traces1 from "tests/assets/traces1.solution.json"

describe("checkEachPcbTraceNonOverlapping", () => {
  test("traces1 should have one trace overlap error", () => {
    const soup: AnyCircuitElement[] = traces1 as any

    const errors = checkEachPcbTraceNonOverlapping(soup)

    expect(errors).toHaveLength(1)
  })
})
