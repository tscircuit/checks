import { expect, test } from "bun:test"
import { checkScopedCopperClearance } from "../../index"
import { clearanceFixture } from "./scoped-clearance-fixture"

test("priority overrides a larger lower-priority rule and unsupported selectors report incomplete verification", () => {
  const circuit = clearanceFixture()
  const board = circuit.find((element) => element.type === "pcb_board")!
  board.clearance_rules![0]!.clearance = 0.1
  board.clearance_rules![1]!.clearance = 25.4
  expect(checkScopedCopperClearance(circuit)).toEqual([])
  board.clearance_rules![0]!.enabled = false
  expect(checkScopedCopperClearance(circuit)[0]!.minimum_clearance).toBe(25.4)
  board.clearance_rules![0]!.enabled = true
  board.clearance_rules![0]!.scope1 = {
    type: "unsupported",
    expression: "InRoom('HV')",
  }
  expect(checkScopedCopperClearance(circuit)[0]!.is_fatal).toBe(true)
  board.clearance_rules![0]!.scope1 = {
    type: "and",
    scopes: [
      { type: "unsupported", expression: "IsArc" },
      { type: "property", property: "is_keepout" },
    ],
  }
  expect(checkScopedCopperClearance(circuit)[0]!.minimum_clearance).toBe(25.4)
  board.clearance_rules = []
  expect(checkScopedCopperClearance(circuit)).toEqual([])
})
