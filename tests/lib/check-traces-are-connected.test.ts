import { expect, test, describe } from "bun:test"
import { checkTracesAreConnected } from "lib/check-traces-are-connected"
import soup from "tests/assets/traces1.solution.json"
import soup2 from "tests/assets/traces5-missing-trace-end.json"

describe("testing checkTracesAreConnected(", () => {
  test("should not error as traces are connected", () => {
    const errors = checkTracesAreConnected(soup as any)
    expect(errors).toHaveLength(0)
  })
  test("should error as a trace is not fully connected", () => {
    const errors = checkTracesAreConnected(soup2 as any)
    expect(errors).not.toHaveLength(0)
  })
})
