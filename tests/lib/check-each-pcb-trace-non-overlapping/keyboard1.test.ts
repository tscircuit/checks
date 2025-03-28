import keyboard1 from "tests/assets/keyboard1.json"
import { test, expect } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

test("keyboard1", () => {
  const errors = checkEachPcbTraceNonOverlapping(keyboard1)

  // Placeholder for snapshot sake, have no idea what this number should be
  expect(errors.length).toBe(90)
})
