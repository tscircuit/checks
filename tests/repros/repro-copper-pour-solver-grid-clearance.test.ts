import { expect, test } from "bun:test"
import { checkCopperToBoardEdgeClearance } from "lib/check-copper-to-board-edge-clearance"
import { solverGridRoundedPour } from "tests/fixtures/copper-to-board-edge-clearance"

test("a copper pour rounded by the solver grid does not violate board-edge clearance", () => {
  expect(checkCopperToBoardEdgeClearance(solverGridRoundedPour)).toEqual([])
})
