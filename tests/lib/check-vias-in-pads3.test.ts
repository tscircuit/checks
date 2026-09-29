import { expect, test } from "bun:test"
import { checkViaPadClearance } from "lib/check-via-pad-clearance"
import { checkViasInPads } from "lib/check-vias-in-pads"
import {
  issueCornerPad,
  issueCornerVia,
  makeBoard,
} from "./check-vias-in-pads-fixtures"

test("reports unresolved-net copper contact as clearance, not via-in-pad", () => {
  const circuitJson = [makeBoard(), issueCornerPad, issueCornerVia]
  expect(checkViasInPads(circuitJson)).toEqual([])
  expect(checkViaPadClearance(circuitJson)).toHaveLength(1)
})
