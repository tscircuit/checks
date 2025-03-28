import keyboard2 from "tests/assets/keyboard2.json"
import { test, expect } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

test("keyboard2", () => {
  const errors = checkEachPcbTraceNonOverlapping(keyboard2 as any)

  expect(errors).toMatchInlineSnapshot(`[]`)
})
