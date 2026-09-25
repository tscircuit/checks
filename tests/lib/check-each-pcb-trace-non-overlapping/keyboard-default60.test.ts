import keyboard60 from "tests/assets/keyboard-default60.json"
import { test, expect } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

test("keyboard60 exposes seven NPTH clearances below the 0.2 mm default", () => {
  const errors = checkEachPcbTraceNonOverlapping(keyboard60)

  expect(errors).toHaveLength(7)
  expect(
    errors.every((error) => error.message.includes("non-plated hole")),
  ).toBe(true)
})
