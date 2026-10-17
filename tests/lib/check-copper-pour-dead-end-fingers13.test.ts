import { expect, test } from "bun:test"
import { runAllRoutingChecks } from "../../index"
import { pour, circuit } from "../fixtures/copper-pour-dead-end-fingers"

test("runs automatically with routing checks and leaves the supplied geometry unchanged", async () => {
  const input = circuit(pour())
  const original = structuredClone(input)
  const errors = await runAllRoutingChecks(input)
  expect(
    errors.some((error) => error.message.includes("dead-end finger")),
  ).toBe(true)
  expect(input).toEqual(original)
})
