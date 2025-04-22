import gapOverlapBoard from "tests/assets/gap-overlap-board.json"
import { test, expect } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

test("gap overlap board", () => {
  const errors = checkEachPcbTraceNonOverlapping(gapOverlapBoard as any)

  expect(errors.length).toBe(0)
})
