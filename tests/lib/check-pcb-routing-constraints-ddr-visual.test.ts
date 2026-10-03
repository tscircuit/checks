import { expect, test } from "bun:test"
import type { SourceTrace } from "circuit-json"
import { checkPcbRoutingConstraints } from "../../lib/check-pcb-routing-constraints"
import { measureRoute } from "../../lib/util/measure-route"
import {
  ddrScenario,
  renderDdrComparison,
  type VisualRule,
} from "../fixtures/ddr-routing-constraint-visual"

for (const rule of [
  "length_skew",
  "min_length",
  "max_length",
  "target_length",
  "pcb_trace_spacing",
  "pcb_spacing_to_other_signals",
] as VisualRule[]) {
  test(`routed DDR ${rule}: passing control and highlighted measured violation`, () => {
    const { control, changed } = ddrScenario(rule)
    expect(checkPcbRoutingConstraints(control.circuit)).toEqual([])
    for (const fixture of [control, changed])
      for (const trace of fixture.traces) {
        const source = fixture.circuit.find(
          (e): e is SourceTrace =>
            e.type === "source_trace" &&
            e.source_trace_id === trace.source_trace_id,
        )!
        expect(measureRoute(source, [trace], fixture.circuit)).toBeDefined()
        expect(trace.route.filter((p) => p.route_type === "via")).toHaveLength(
          2,
        )
      }
    // Independent expected totals (sum of the authored polylines), not cached
    // lengths or the checker measurement routine. Skew = longest minus shortest.
    const totals = changed.traces.map((trace) =>
      trace.route.slice(1).reduce((sum, point, index) => {
        const previous = trace.route[index]!
        if (
          point.route_type === "through_pad" ||
          previous.route_type === "through_pad"
        )
          throw new Error("Unexpected through-pad in coupon")
        return sum + Math.hypot(point.x - previous.x, point.y - previous.y)
      }, 0),
    )
    const errors = checkPcbRoutingConstraints(changed.circuit)
    expect(errors.length).toBeGreaterThan(0)
    expect(
      errors.every(
        (e) =>
          e.type === "pcb_bus_routing_constraint_error" &&
          e.routing_rule === rule,
      ),
    ).toBe(true)
    for (const error of errors) {
      if (error.type !== "pcb_bus_routing_constraint_error")
        throw new Error("Unexpected warning")
      if (error.routing_rule === "length_skew")
        expect(error.actual_length_skew).toBeCloseTo(
          Math.max(...totals) - Math.min(...totals),
          9,
        )
      if ("actual_trace_length" in error)
        expect(error.actual_trace_length).toBeCloseTo(totals[0]!, 9)
    }
    if (rule.includes("spacing"))
      for (const error of errors) {
        if (
          error.type !== "pcb_bus_routing_constraint_error" ||
          !("actual_centerline_spacing" in error)
        )
          throw new Error("Expected measured spacing")
        expect(error.actual_centerline_spacing).toBeGreaterThanOrEqual(
          0.2 - 1e-9,
        )
        expect(error.actual_centerline_spacing).toBeLessThan(
          error.minimum_centerline_spacing,
        )
        expect(error.other_pcb_trace_id).toBeDefined()
      }
    expect(renderDdrComparison(rule, control, changed)).toMatchSvgSnapshot(
      import.meta.path,
      `ddr-routing-${rule}`,
    )
  })
}
