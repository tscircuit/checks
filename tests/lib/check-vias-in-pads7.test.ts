import { expect, test } from "bun:test"
import type { PcbVia } from "circuit-json"
import { checkViasInPads } from "lib/check-vias-in-pads"
import { makeBoard, rectPad, viaInRectPad } from "./check-vias-in-pads-fixtures"

test("ignores an overlap on non-overlapping layers", () => {
  const innerLayerVia: PcbVia = {
    ...viaInRectPad,
    layers: ["inner1", "inner2"],
  }

  expect(checkViasInPads([makeBoard(), rectPad, innerLayerVia])).toEqual([])
})
