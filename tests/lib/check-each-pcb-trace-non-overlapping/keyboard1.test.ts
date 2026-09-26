import { expect, test } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkPadTraceClearance } from "lib/check-pad-trace-clearance"
import { checkViaTraceClearance } from "lib/check-via-trace-clearance"
import { checkHoleTraceClearance } from "lib/check-hole-trace-clearance"
import keyboard1 from "tests/assets/keyboard1.json"

test("keyboard1", () => {
  const overlapErrors = checkEachPcbTraceNonOverlapping(keyboard1).filter(
    (diagnostic) => diagnostic.type === "pcb_trace_error",
  )
  const clearanceErrors = [
    ...checkPadTraceClearance(keyboard1),
    ...checkViaTraceClearance(keyboard1),
    ...checkHoleTraceClearance(keyboard1),
  ]

  expect(overlapErrors).toHaveLength(27)
  expect(clearanceErrors).toHaveLength(21)
  expect(overlapErrors.length + clearanceErrors.length).toBe(48)
  expect(
    clearanceErrors.some((error) => {
      const overlapId =
        error.type === "pcb_trace_error"
          ? error.pcb_trace_error_id
          : `overlap_${error.pcb_trace_id}_${error.type === "pcb_pad_trace_clearance_error" ? error.pcb_pad_id : error.pcb_via_id}`
      return overlapErrors.some(
        (overlapError) => overlapError.pcb_trace_error_id === overlapId,
      )
    }),
  ).toBe(false)
})
