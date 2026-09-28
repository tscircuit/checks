import { expect, test } from "bun:test"
import { traceWidthFixture as fixture } from "../fixtures/trace-width"
import { checkSourceTracesMatchPcbTraceThickness } from "lib/check-source-traces-match-pcb-trace-thickness"
import { runAllRoutingChecks } from "lib/run-all-checks"

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
