import { expect, test } from "bun:test"
import { runAllChecks } from "../.." // index.ts when imported from root

test("runAllChecks executes checks on tscircuit code", async () => {
  const errors = await runAllChecks(
    `export default () => (<resistor name="R1" resistance="1k" />)`,
  )
  expect(Array.isArray(errors)).toBe(true)
  expect(errors.length).toBe(0)
})
