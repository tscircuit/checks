import { expect, test } from "bun:test"
import type { PcbVia } from "circuit-json"
import { checkViasInPads } from "lib/check-vias-in-pads"
import { makeBoard, rectPad, viaInRectPad } from "./check-vias-in-pads-fixtures"

test("ignores external copper tangency for via-in-pad", () => {
  const tangentVia: PcbVia = {
    ...viaInRectPad,
    x: 0.7,
    y: 0,
  }

  expect(checkViasInPads([makeBoard(), rectPad, tangentVia])).toEqual([])
})
