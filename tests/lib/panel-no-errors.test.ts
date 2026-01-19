import { expect, test } from "bun:test"
import panelNoErrors from "tests/assets/panel-no-errors.json"
import { runAllChecks } from "../.."
import type { AnyCircuitElement } from "circuit-json"

test("panel-no-errors.json should have no DRC errors", async () => {
  const errors = await runAllChecks(panelNoErrors as AnyCircuitElement[])
  expect(errors).toEqual([])
})
