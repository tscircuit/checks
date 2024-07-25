import { expect, test, describe } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping"
import type { AnySoupElement, PCBTrace, PCBSMTPad } from "@tscircuit/soup"
import traces3 from "tests/assets/traces3.solution.json"

describe("checkEachPcbTraceNonOverlapping", () => {
  test("should return no errors when traces don't overlap", () => {
    const soup: AnySoupElement[] = traces3 as any

    expect(checkEachPcbTraceNonOverlapping(soup)).toHaveLength(1)
  })
})
