import keyboard60 from "tests/assets/keyboard-default60.json"
import { test, expect } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

test("keyboard1", () => {
  const errors = checkEachPcbTraceNonOverlapping(keyboard60)

  // Placeholder for snapshot sake, have no idea what this number should be
  expect(errors.length).toBe(0)
})
