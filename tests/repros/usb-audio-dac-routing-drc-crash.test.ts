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

test("USB audio DAC full board exposes the clearance error when checked independently", () => {
  const errors = checkEachPcbTraceNonOverlapping(circuitJson)
  expect(errors).toContainEqual(missedClearanceError)
})

test("USB audio DAC routing checks retain the clearance error and report failed copper conversion", async () => {
  const errors = await runAllRoutingChecks(circuitJson)
  expect(errors).toContainEqual(missedClearanceError)
  expect(errors).toContainEqual(
    expect.objectContaining({
      type: "pcb_placement_error",
      is_fatal: true,
      message: expect.stringContaining("Cannot check copper pour shorts"),
    }),
  )
  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
