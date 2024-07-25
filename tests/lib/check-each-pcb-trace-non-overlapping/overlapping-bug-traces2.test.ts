import { expect, test, describe } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping"
import type { AnySoupElement, PCBTrace, PCBSMTPad } from "@tscircuit/soup"
import traces2 from "tests/assets/traces2.solution.json"

describe("checkEachPcbTraceNonOverlapping", () => {
  test("traces2 should have one trace overlap error", () => {
    const soup: AnySoupElement[] = traces2 as any

    expect(checkEachPcbTraceNonOverlapping(soup)).toHaveLength(1)
  })
})
