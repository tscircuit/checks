import { expect, test } from "bun:test"
import { checkViasInPads } from "lib/check-vias-in-pads"
import { makeBoard, supportedPadCases } from "./check-vias-in-pads-fixtures"

test.each(supportedPadCases)(
  "detects copper overlap with a $shape pad",
  ({ pad, via }) => {
    expect(checkViasInPads([makeBoard(), pad, via])).toHaveLength(1)
  },
)
