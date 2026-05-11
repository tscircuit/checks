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

  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...routingIssues], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
