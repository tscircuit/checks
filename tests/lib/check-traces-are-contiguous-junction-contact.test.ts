import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"

type WirePoint = Extract<PcbTrace["route"][number], { route_type: "wire" }>
const wire = (x: number, y: number, width = 0.2): WirePoint => ({
  route_type: "wire",
  x,
  y,
  width,
  layer: "top",
})
function endpointErrors(route: WirePoint[], candidate: WirePoint[]) {
  const circuit: AnyCircuitElement[] = [
    {
      type: "source_trace",
      source_trace_id: "source_trace_net",
      connected_source_port_ids: [],
      connected_source_net_ids: ["source_net"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "target",
      source_trace_id: "source_trace_net",
      route,
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "candidate",
      source_trace_id: "source_trace_net",
      route: candidate,
    },
  ]
  return checkTracesAreContiguous(circuit)
    .filter((error) => error.pcb_trace_id === "target")
    .map((error) => error.pcb_trace_error_id)
}

test("preserves valid contacts and detects short branches independent of subdivision", () => {
  // accepts forward-facing rounded cap overlap without a shared inward junction
  expect(
    endpointErrors([wire(-1, 0), wire(0, 0)], [wire(0.1, 0), wire(1, 0)]),
  ).not.toContain("disconnected_endpoint_target_end")
  // accepts a centerline T junction and a collinear overlap
  expect(
    endpointErrors([wire(0, -1), wire(0, 0)], [wire(-1, 0), wire(1, 0)]),
  ).not.toContain("disconnected_endpoint_target_end")
  expect(
    endpointErrors([wire(-0.1, 0), wire(0, 0)], [wire(-1, 0), wire(1, 0)]),
  ).toEqual([])
  // rejects a short branch departing from a midpoint junction even inside its copper
  expect(
    endpointErrors([wire(0, 0), wire(0, 0.05)], [wire(-1, 0), wire(1, 0)]),
  ).toEqual(["disconnected_endpoint_target_end"])
  // checks both route orders and skips duplicate terminal points
  const candidate = [wire(-1, 0), wire(1, 0)]
  expect(
    endpointErrors([wire(0, 0.05), wire(0, 0.05), wire(0, 0)], candidate),
  ).toEqual(["disconnected_endpoint_target_start"])
  expect(
    endpointErrors([wire(0, 0), wire(0, 0.05), wire(0, 0.05)], candidate),
  ).toEqual(["disconnected_endpoint_target_end"])
  // retains a wide endpoint edge contact approaching another trace
  expect(
    endpointErrors(
      [wire(0, 1, 0.6), wire(0, 0.3, 0.6)],
      [wire(-1, 0), wire(1, 0)],
    ),
  ).not.toContain("disconnected_endpoint_target_end")

  // subdividing the terminal centerline cannot hide a short branch

  expect(
    endpointErrors([wire(0, 0), wire(0, 0.025), wire(0, 0.05)], candidate),
  ).toEqual(["disconnected_endpoint_target_end"])
  expect(
    endpointErrors([wire(0, 0.05), wire(0, 0.025), wire(0, 0)], candidate),
  ).toEqual(["disconnected_endpoint_target_start"])

  // subdividing the contacting trunk does not hide the branch tip
  expect(
    endpointErrors(
      [wire(0, 0), wire(0, 0.05)],
      [wire(-1, 0), wire(0.02, 0), wire(1, 0)],
    ),
  ).toEqual(["disconnected_endpoint_target_end"])
  // A narrower endpoint wholly inside the trunk has no exposed spur.
  expect(
    endpointErrors(
      [wire(0, 0, 0.1), wire(0, 0.025, 0.1)],
      [wire(-1, 0, 1), wire(1, 0, 1)],
    ),
  ).toEqual([])
})
