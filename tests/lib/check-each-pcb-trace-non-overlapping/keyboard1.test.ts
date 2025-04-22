import keyboard1 from "tests/assets/keyboard1.json"
import { test, expect } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

test("keyboard1", () => {
  const errors = checkEachPcbTraceNonOverlapping(keyboard1)

  expect(errors.length).toBe(22)
})
