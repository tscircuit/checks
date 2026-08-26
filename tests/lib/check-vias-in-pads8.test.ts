import { expect, test } from "bun:test"
import { checkViasInPads } from "lib/check-vias-in-pads"
import { makeBoard, rectPad, viaInRectPad } from "./check-vias-in-pads-fixtures"

test("respects the board via-in-pad allowance", () => {
  expect(checkViasInPads([makeBoard(true), rectPad, viaInRectPad])).toEqual([])
  expect(
    checkViasInPads([makeBoard(false), rectPad, viaInRectPad]),
  ).toHaveLength(1)
})
