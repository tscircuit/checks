import keyboard60 from "tests/assets/keyboard-default60.json"
import { test, expect } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

test("keyboard1", () => {
  const errors = checkEachPcbTraceNonOverlapping(keyboard60)

  expect(errors.length).toBe(0)
})
