import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { runAllRoutingChecks } from "lib/run-all-checks"

// A subcircuit whose autorouting core skipped because of placement errors:
// the source trace has no pcb_trace, but only because the router never ran.
const circuitJson = [
  {
    type: "source_trace",
    source_trace_id: "source_trace_0",
    subcircuit_id: "subcircuit_0",
    connected_source_port_ids: ["source_port_0", "source_port_1"],
    connected_source_net_ids: [],
    display_name: ".R1 > .pin2 to .R2 > .pin1",
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_0",
    source_port_id: "source_port_0",
    pcb_component_id: "pcb_component_0",
    x: 0,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_1",
    source_port_id: "source_port_1",
    pcb_component_id: "pcb_component_1",
    x: 5,
    y: 0,
    layers: ["top"],
  },
] as unknown as AnyCircuitElement[]

const skippedAutoroutingError = {
  type: "pcb_autorouting_error",
  pcb_error_id: "pcb_autorouting_skipped_placement_errors_subcircuit_0",
  error_type: "pcb_autorouting_error",
  subcircuit_id: "subcircuit_0",
  message:
    "Autorouting was skipped because 1 PCB placement error was found. Fix the placement errors or set placementDrcChecksDisabled to true to route anyway.",
} as unknown as AnyCircuitElement

test("reports missing traces when autorouting actually ran", async () => {
  const findings = await runAllRoutingChecks(circuitJson)
  const types = findings.map((f) => f.type)
  expect(types).toContain("pcb_trace_missing_error")
  expect(types).toContain("pcb_port_not_connected_error")
})

test("suppresses derived findings when autorouting was skipped for placement errors", async () => {
  const findings = await runAllRoutingChecks([
    ...circuitJson,
    skippedAutoroutingError,
  ])
  const types = findings.map((f) => f.type)
  expect(types).not.toContain("pcb_trace_missing_error")
  expect(types).not.toContain("pcb_port_not_connected_error")
})

test("does not suppress findings for other subcircuits", async () => {
  const findings = await runAllRoutingChecks([
    ...circuitJson,
    {
      ...(skippedAutoroutingError as any),
      pcb_error_id: "pcb_autorouting_skipped_placement_errors_subcircuit_9",
      subcircuit_id: "subcircuit_9",
    } as unknown as AnyCircuitElement,
  ])
  expect(findings.map((f) => f.type)).toContain("pcb_trace_missing_error")
})

test("does not suppress findings for unrelated autorouting errors", async () => {
  const findings = await runAllRoutingChecks([
    ...circuitJson,
    {
      type: "pcb_autorouting_error",
      pcb_error_id: "pcb_autorouting_error_0",
      error_type: "pcb_autorouting_error",
      subcircuit_id: "subcircuit_0",
      message: "cF ran out of iterations",
    } as unknown as AnyCircuitElement,
  ])
  expect(findings.map((f) => f.type)).toContain("pcb_trace_missing_error")
})
