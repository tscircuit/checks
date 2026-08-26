import { expect, test } from "bun:test"
import type { PcbVia } from "circuit-json"
import { checkViasInPads } from "lib/check-vias-in-pads"
import { makeBoard, rectPad, viaInRectPad } from "./check-vias-in-pads-fixtures"

test("ignores a corner near-miss whose copper bounds touch the pad bounds", () => {
  const cornerNearMissVia: PcbVia = {
    ...viaInRectPad,
    x: 0.7,
    y: 0.7,
  }

  expect(checkViasInPads([makeBoard(), rectPad, cornerNearMissVia])).toEqual([])
})
