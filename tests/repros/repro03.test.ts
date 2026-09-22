import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { runAllRoutingChecks } from "../../lib/run-all-checks"
import repro03 from "../assets/motor-controller.json"

test("motor controller should report the motor controller overlap", async () => {
  const circuitJson = repro03 as AnyCircuitElement[]
  const routingIssues = await runAllRoutingChecks(circuitJson)

  expect(routingIssues).toContainEqual(
    expect.objectContaining({
      pcb_trace_error_id: "missing_connection_source_trace_25_0_pcb_port_40",
      center: { x: -19.641272, y: 10.5 },
    }),
  )

  // The bottom-layer end at (-16.400003, 1.2) also floats: the nearest
  // same-net fragment ends 0.224993 mm away on top, without a via here.
  // Required ports being connected elsewhere must not hide this free end.
  expect(routingIssues).toContainEqual(
    expect.objectContaining({
      pcb_trace_error_id: "disconnected_endpoint_source_trace_34_1_end",
    }),
  )

  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...routingIssues], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
