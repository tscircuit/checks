import { expect, test, describe } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import type { AnySoupElement, PCBTrace, PCBSMTPad } from "circuit-json"
import traces2 from "tests/assets/traces2.solution.json"

describe("checkEachPcbTraceNonOverlapping", () => {
  test("traces2 should have one trace overlap error", () => {
    const soup: AnySoupElement[] = traces2 as any

    const errors = checkEachPcbTraceNonOverlapping(soup)

    expect(checkEachPcbTraceNonOverlapping(soup)).toHaveLength(14)
  })
})
