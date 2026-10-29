import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { runAllRoutingChecks } from "../../lib/run-all-checks"
import repro03 from "../assets/motor-controller.json"

test("motor controller accepts pad-edge copper contact and still detects a gap", async () => {
  const circuitJson = repro03 as AnyCircuitElement[]
  const routingIssues = await runAllRoutingChecks(circuitJson)

  const trace = circuitJson.find(
    (element) =>
      element.type === "pcb_trace" &&
      element.pcb_trace_id === "source_trace_25_0",
  )!
  const pad = circuitJson.find(
    (element) =>
      element.type === "pcb_smtpad" && element.pcb_port_id === "pcb_port_40",
  )!
  if (
    trace.type !== "pcb_trace" ||
    pad.type !== "pcb_smtpad" ||
    pad.shape !== "rect"
  ) {
    throw new Error("Expected the motor controller's pad-edge trace fixture")
  }
  const endpoint = trace.route.at(-1)!
  if (endpoint.route_type !== "wire")
    throw new Error("Expected a wire endpoint")
  // Rounding leaves the center only 0.0000002 mm outside the pad. Its
  // 0.075 mm copper radius overlaps the pad, so this is a real connection.
  const centerGap = pad.x - pad.width / 2 - endpoint.x
  expect(centerGap).toBeGreaterThan(0)
  expect(centerGap).toBeLessThan(endpoint.width / 2)
  expect(routingIssues).not.toContainEqual(
    expect.objectContaining({
      pcb_trace_error_id: "missing_connection_source_trace_25_0_pcb_port_40",
      center: { x: -19.641272, y: 10.5 },
    }),
  )

  const disconnected = structuredClone(circuitJson)
  const disconnectedTrace = disconnected.find(
    (element) =>
      element.type === "pcb_trace" &&
      element.pcb_trace_id === trace.pcb_trace_id,
  )!
  if (disconnectedTrace.type !== "pcb_trace")
    throw new Error("Expected a PCB trace")
  const disconnectedEnd = disconnectedTrace.route.at(-1)!
  if (disconnectedEnd.route_type !== "wire")
    throw new Error("Expected a wire endpoint")
  disconnectedEnd.x -= 0.1
  expect(await runAllRoutingChecks(disconnected)).toContainEqual(
    expect.objectContaining({
      pcb_trace_error_id: "missing_connection_source_trace_25_0_pcb_port_40",
    }),
  )

  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...routingIssues], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
