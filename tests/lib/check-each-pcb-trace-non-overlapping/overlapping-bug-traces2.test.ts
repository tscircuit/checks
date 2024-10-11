import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping"
import traces2 from "tests/assets/traces2.solution.json"

describe("checkEachPcbTraceNonOverlapping", () => {
  test("traces2 should have one trace overlap error", () => {
    const soup: AnyCircuitElement[] = traces2 as any

    expect(checkEachPcbTraceNonOverlapping(soup)).toHaveLength(1)
  })
})
