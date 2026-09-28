import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { checkSourceTracesMatchPcbTraceThickness } from "lib/check-source-traces-match-pcb-trace-thickness"
import { runAllRoutingChecks } from "lib/run-all-checks"

function fixture(
  widths: number[],
  mode?: PcbTrace["route_thickness_mode"],
): AnyCircuitElement[] {
  return [
    {
      type: "source_trace",
      source_trace_id: "source_trace_0",
      connected_source_port_ids: ["source_port_0", "source_port_1"],
      connected_source_net_ids: [],
      min_trace_thickness: 1,
      display_name: "Power rail",
    },
    ...[0, 1].map((i) => ({
      type: "pcb_port" as const,
      pcb_port_id: `pcb_port_${i}`,
      source_port_id: `source_port_${i}`,
      pcb_component_id: `pcb_component_${i}`,
      x: i * (widths.length - 1) * 10,
      y: 0,
      layers: ["top" as const],
    })),
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_0",
      source_trace_id: "source_trace_0",
      route_thickness_mode: mode,
      route: widths.map((width, i) => ({
        route_type: "wire" as const,
        x: i * 10,
        y: 0,
        width,
        layer: "top" as const,
        ...(i === 0 ? { start_pcb_port_id: "pcb_port_0" } : {}),
        ...(i === widths.length - 1 ? { end_pcb_port_id: "pcb_port_1" } : {}),
      })),
    },
  ]
}

const check = checkSourceTracesMatchPcbTraceThickness

test("a narrow terminal point cannot mask an undersized constant-width segment", () => {
  const warnings = check(fixture([1, 0.5, 0.1]))
  expect(warnings).toHaveLength(1)
  expect(warnings[0].center).toEqual({ x: 15, y: 0 })
  expect(warnings[0].message).toContain("actual: 0.5mm")
})

test("a terminal point alone does not define narrow constant-width copper", () => {
  expect(check(fixture([1, 0.1]))).toHaveLength(0)
})

test("interpolated narrowing and widening mark only the deficient portion", () => {
  const narrowing = check(fixture([1.5, 0.5], "interpolated"))
  expect(narrowing).toHaveLength(1)
  expect(narrowing[0].center).toEqual({ x: 7.5, y: 0 })
  const widening = check(fixture([0.5, 1.5], "interpolated"))
  expect(widening).toHaveLength(1)
  expect(widening[0].center).toEqual({ x: 2.5, y: 0 })
  expect(check(fixture([1, 1.5], "interpolated"))).toHaveLength(0)
})

test("zero-length points cannot create or mask a width warning", () => {
  const circuit = fixture([0.1, 0.5, 1])
  const trace = circuit.find((e) => e.type === "pcb_trace")!
  if (trace.route[1].route_type === "wire") trace.route[1].x = 0
  const warnings = check(circuit)
  expect(warnings).toHaveLength(1)
  expect(warnings[0].center).toEqual({ x: 10, y: 0 })
  expect(warnings[0].message).toContain("actual: 0.5mm")
  const safeCircuit = fixture([0.1, 1, 1])
  const safeTrace = safeCircuit.find((e) => e.type === "pcb_trace")!
  if (safeTrace.route[1].route_type === "wire") safeTrace.route[1].x = 0
  expect(check(safeCircuit)).toHaveLength(0)
})

test("layer transitions do not define in-layer wire segments", () => {
  const circuit = fixture([0.1, 1])
  const trace = circuit.find((e) => e.type === "pcb_trace")!
  if (trace.route[1].route_type === "wire") trace.route[1].layer = "bottom"
  expect(check(circuit)).toHaveLength(0)
})

test("normal routing checks include explicit width warnings", async () => {
  const warnings = (await runAllRoutingChecks(fixture([0.5, 0.5]))).filter(
    (e) => e.type === "pcb_trace_warning",
  )
  expect(warnings).toHaveLength(1)
  expect(warnings[0].message).toContain("requested: 1mm, actual: 0.5mm")
})

test("traces without a requested width do not produce width warnings", () => {
  const circuit = fixture([0.1, 0.1])
  const source = circuit.find((e) => e.type === "source_trace")!
  delete source.min_trace_thickness
  expect(check(circuit)).toHaveLength(0)
})
