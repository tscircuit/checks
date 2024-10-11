import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping"
import traces1 from "tests/assets/traces1.solution.json"

describe("checkEachPcbTraceNonOverlapping", () => {
  test("traces1 should have one trace overlap error", () => {
    const soup: AnyCircuitElement[] = traces1 as any

    expect(checkEachPcbTraceNonOverlapping(soup)).toHaveLength(1)
  })
})
