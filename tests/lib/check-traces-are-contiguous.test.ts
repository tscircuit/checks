import { expect, test, describe } from "bun:test"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import circuitJson from "tests/assets/traces-with-vias-2.json"
import corruptedCircuitJson from "tests/assets/traces-with-vias-corrupted.json"

describe("testing checkTracesAreContiguous(", () => {
  test("should not error as traces are contiguous", () => {
    const errors = checkTracesAreContiguous(circuitJson as any)
    expect(errors).toHaveLength(0)
  })
  test("should error as a trace is not fully contiguous", () => {
    const errors = checkTracesAreContiguous(corruptedCircuitJson as any)
    expect(errors[0].message).toContain("misaligned")
    expect(errors[1].message).toContain("missing a connection")
  })
})
