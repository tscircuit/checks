import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace, SourceTrace } from "circuit-json"
import { checkPcbTraceLengths } from "lib/check-pcb-trace-lengths"
import { checkPcbTraceViaCounts } from "lib/check-pcb-trace-via-counts"
import fixture from "../assets/bluetooth-pedometer-clock.circuit.json"

test.each(
  [false, true].flatMap((twoTerminals) =>
    [1, 5, 6, 9, 10].map((splitIndex) => [twoTerminals, splitIndex] as const),
  ),
)(
  "splitting the real clock preserves findings (two terminals: %s, split: %s)",
  (twoTerminals, splitIndex) => {
    const circuit = structuredClone(fixture) as AnyCircuitElement[]
    const rule = circuit.find(
      (element) =>
        element.type === "source_trace" &&
        element.source_trace_id === "source_trace_217",
    ) as SourceTrace
    if (twoTerminals) rule.connected_source_port_ids.push("source_port_171")
    const clock = circuit.find(
      (element) =>
        element.type === "pcb_trace" &&
        element.pcb_trace_id === "source_net_29_0",
    ) as PcbTrace
    const originalRoute = structuredClone(clock.route)
    const findings = () => ({
      length: checkPcbTraceLengths(circuit).find(
        (error) => error.source_trace_id === rule.source_trace_id,
      ),
      vias: checkPcbTraceViaCounts(circuit).find(
        (error) => error.source_trace_id === rule.source_trace_id,
      ),
    })
    const before = findings()
    expect(before.length?.actual_trace_length).toBeCloseTo(10.61060763353529, 9)
    expect(before.vias?.message).toBe(
      "PCB trace uses 2 vias, exceeding the 0 maximum",
    )

    clock.route = originalRoute.slice(0, splitIndex + 1)
    circuit.push({
      ...clock,
      pcb_trace_id: "clock_continuation",
      route: originalRoute.slice(splitIndex),
    })
    const after = findings()
    expect(after.length?.actual_trace_length).toBeCloseTo(
      before.length!.actual_trace_length,
      9,
    )
    expect(after.vias?.message).toBe(before.vias!.message)

    // A much longer branch is electrically and physically connected at the
    // split, but is not part of the path between the clock terminals.
    const junction = originalRoute[10]!
    if (junction.route_type !== "wire")
      throw new Error("Expected a wire junction")
    circuit.push({
      ...clock,
      pcb_trace_id: "unrelated_connected_branch",
      route: [
        junction,
        { route_type: "wire", x: 80, y: 20, width: 0.1, layer: "top" },
        {
          route_type: "via",
          x: 80,
          y: 20,
          from_layer: "top",
          to_layer: "bottom",
        },
        {
          route_type: "wire",
          x: 90,
          y: 20,
          width: 0.1,
          layer: "bottom",
          end_pcb_port_id: "branch_port",
        },
      ],
    })
    expect(findings()).toEqual(after)
  },
)

test("shared clock copper produces a unique length error for each constraint", () => {
  const circuit = structuredClone(fixture) as AnyCircuitElement[]
  const rule = circuit.find(
    (element) =>
      element.type === "source_trace" &&
      element.source_trace_id === "source_trace_217",
  ) as SourceTrace
  circuit.push({
    ...rule,
    source_trace_id: "opposite_clock_rule",
    connected_source_port_ids: ["source_port_171"],
    max_length: 4,
  })
  const errors = checkPcbTraceLengths(circuit).filter((error) =>
    [rule.source_trace_id, "opposite_clock_rule"].includes(
      error.source_trace_id!,
    ),
  )
  expect(errors).toHaveLength(2)
  expect(
    new Set(errors.map((error) => error.pcb_trace_too_long_error_id)).size,
  ).toBe(2)
  for (const error of errors) {
    expect(error.pcb_trace_too_long_error_id).toContain(error.source_trace_id!)
    expect(error.actual_trace_length).toBeCloseTo(10.61060763353529, 9)
  }
})
