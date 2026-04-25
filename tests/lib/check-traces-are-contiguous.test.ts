import { expect, test, describe } from "bun:test"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import circuitJson from "tests/assets/traces-with-vias-2.json"
import corruptedCircuitJson from "tests/assets/traces-with-vias-corrupted.json"
import repro02 from "tests/assets/motor-controller-1.json"
import type { AnyCircuitElement } from "circuit-json"
import { runAllRoutingChecks } from "lib/run-all-checks"

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

test("repro02 should report the J_VMOTOR GND trace disconnected endpoint", async () => {
  const circuitJson = repro02 as AnyCircuitElement[]
  const routingIssues = await runAllRoutingChecks(circuitJson)

  expect(routingIssues).toContainEqual(
    expect.objectContaining({
      type: "pcb_trace_error",
      pcb_trace_id: "source_net_0_mst2_0",
      pcb_trace_error_id: "disconnected_endpoint_source_net_0_mst2_0_end",
      message: "Trace [net.GND] has disconnected endpoint at (22.03, -10.22)",
    }),
  )
})
