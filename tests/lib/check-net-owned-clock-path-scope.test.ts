import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { checkPcbTraceLengths } from "lib/check-pcb-trace-lengths"
import { checkPcbTraceViaCounts } from "lib/check-pcb-trace-via-counts"
import fixture from "../assets/bluetooth-pedometer-clock.circuit.json"

test("net-owned clock checks follow its terminal and ignore unrelated branches", () => {
  const circuit = structuredClone(fixture) as AnyCircuitElement[]
  const clock = circuit.find(
    (element) =>
      element.type === "pcb_trace" &&
      element.pcb_trace_id === "source_net_29_0",
  ) as PcbTrace
  const oldRoute = structuredClone(clock.route)
  const start = clock.route[0]!
  const end = clock.route.at(-1)!
  if (start.route_type !== "wire" || end.route_type !== "wire")
    throw new Error("Clock fixture needs terminal wires")
  clock.route = [start, end]
  circuit.push({
    ...clock,
    pcb_trace_id: "unrelated_clock_branch",
    route: oldRoute.map((point) =>
      point.route_type === "wire"
        ? {
            ...point,
            x: point.x + 30,
            start_pcb_port_id: undefined,
            end_pcb_port_id: undefined,
          }
        : point.route_type === "via"
          ? { ...point, x: point.x + 30 }
          : point,
    ),
  })
  const findings = () =>
    [
      ...checkPcbTraceViaCounts(circuit),
      ...checkPcbTraceLengths(circuit),
    ].filter((error) => error.source_trace_id === "source_trace_217")
  expect(findings()).toHaveLength(0)
  clock.route = oldRoute
  expect(findings()).toHaveLength(2)
})
