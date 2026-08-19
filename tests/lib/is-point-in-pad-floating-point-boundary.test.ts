import { expect, test } from "bun:test"
import { isPointInPad } from "lib/check-traces-are-contiguous/is-point-in-pad"

test("treats floating-point residue at a rectangular pad boundary as contact", () => {
  const pad = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_boundary",
    shape: "rect",
    x: 2.637275000000003,
    y: 1.053424999999998,
    width: 1.27,
    height: 0.6604,
    layer: "bottom",
  } as const

  expect(
    isPointInPad({ x: 2.637275000000003, y: 1.3836249999999986 }, pad),
  ).toBe(true)
  expect(isPointInPad({ x: 2.637275000000003, y: 1.383626 }, pad)).toBe(false)
})
