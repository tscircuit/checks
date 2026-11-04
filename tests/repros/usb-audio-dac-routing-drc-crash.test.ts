import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { runAllRoutingChecks } from "lib/run-all-checks"
import board from "../assets/usb-audio-dac-drc-crash.json"

// Keep the complete routed board: rerouting the TSX changes the tiny segments
// responsible for the copper-pour geometry exception.
const circuitJson = board as AnyCircuitElement[]
const missedClearanceError = expect.objectContaining({
  type: "pcb_trace_error",
  pcb_trace_error_id: "overlap_source_net_21_mst7_0_source_net_0_mst0_0",
  message: expect.stringContaining("gap: 0.090mm"),
})

test("USB audio DAC full board exposes the clearance error when checked independently", async () => {
  const errors = checkEachPcbTraceNonOverlapping(circuitJson)
  expect(errors).toContainEqual(missedClearanceError)

  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})

test.failing(
  "USB audio DAC routing checks should return the clearance error without throwing",
  async () => {
    // Currently throws in checkCopperPourShorts:
    // source_net_9_mst2_0: Unresolved boundary conflict in boolean operation
    const errors = await runAllRoutingChecks(circuitJson)
    expect(errors).toContainEqual(missedClearanceError)
  },
)
