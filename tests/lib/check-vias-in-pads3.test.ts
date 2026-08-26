import { expect, test } from "bun:test"
import { checkViasInPads } from "lib/check-vias-in-pads"
import {
  issueCornerPad,
  issueCornerVia,
  makeBoard,
} from "./check-vias-in-pads-fixtures"

test("reports an unresolved-net corner overlap", () => {
  expect(
    checkViasInPads([makeBoard(), issueCornerPad, issueCornerVia]),
  ).toHaveLength(1)
})
