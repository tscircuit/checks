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
    expect(errors[0].message).toMatchInlineSnapshot(
      `"Via in trace [.R1 > .pin1 to .C1 > .pin1] is misaligned at position {x: -1.875, y: 1.875}."`,
    )
    expect(errors[1].message).toMatchInlineSnapshot(
      `"Trace [.R1 > .pin1 to .C1 > .pin1] is missing a connection to smtpad[.C1 > .anode]"`,
    )
  })
})
