import { expect, test } from "bun:test"
import { pcb_trace_style_warning, type AnyCircuitElement } from "circuit-json"
import {
  checkPcbTraceStyle,
  runAllChecks,
  runAllRoutingChecks,
} from "../../index"
import fixture from "../assets/rc-car-style-analysis.circuit.json"

const circuitJson = fixture as AnyCircuitElement[]
const enabled = { platformConfig: { pcbStyleChecksEnabled: true } }

test("PCB trace style checks are disabled unless either config explicitly enables them", () => {
  for (const options of [
    {},
    { platformConfig: { pcbStyleChecksEnabled: false } },
    { projectConfig: { pcbStyleChecksEnabled: false } },
  ])
    expect(checkPcbTraceStyle(circuitJson, options)).toEqual([])
  for (const options of [
    enabled,
    { projectConfig: { pcbStyleChecksEnabled: true } },
    {
      platformConfig: { pcbStyleChecksEnabled: false },
      projectConfig: { pcbStyleChecksEnabled: true },
    },
    {
      platformConfig: { pcbStyleChecksEnabled: true },
      projectConfig: { pcbStyleChecksEnabled: false },
    },
  ])
    expect(checkPcbTraceStyle(circuitJson, options)).toHaveLength(2)
})

test("real RC car style warnings retain both measurements and original copper locations", () => {
  const original = JSON.stringify(circuitJson)
  const warnings = checkPcbTraceStyle(circuitJson, enabled)
  expect(
    warnings.map((w) => [w.start_route_index, w.end_route_index, w.layer]),
  ).toEqual([
    [4, 5, "bottom"],
    [5, 6, "bottom"],
  ])
  expect(warnings[0]).toMatchObject({
    type: "pcb_trace_style_warning",
    warning_type: "pcb_trace_style_warning",
    pcb_trace_id: "pcb_trace_3",
    source_trace_id: "source_trace_44",
    styling_issue_type: "long_segment_at_odd_angle",
    segment_start: { x: -15.5, y: 9.1 },
    segment_end: { x: -3, y: -12.000000000000002 },
    center: { x: -9.25, y: -1.450000000000001 },
    minimum_segment_length: 5,
    angle_tolerance_degrees: 4,
  })
  expect(warnings[0].segment_length).toBeCloseTo(24.5246814454337)
  expect(warnings[0].angle_deviation_degrees).toBeCloseTo(14.35677595345652)
  for (const warning of warnings)
    expect(pcb_trace_style_warning.parse(warning)).toEqual(warning)
  expect(new Set(warnings.map((w) => w.pcb_trace_style_warning_id)).size).toBe(
    2,
  )
  expect(checkPcbTraceStyle(circuitJson, enabled)).toEqual(warnings)
  // Moving records within Circuit JSON must not change warning identity.
  expect(checkPcbTraceStyle([...circuitJson].reverse(), enabled)).toEqual(
    warnings,
  )
  for (const warning of warnings) {
    expect(warning).not.toHaveProperty("circuit_json_index")
    expect(warning).not.toHaveProperty("bounds")
  }
  expect(JSON.stringify(circuitJson)).toBe(original)
})

test("style warnings use readable names and honest unnamed labels instead of analyzer IDs", () => {
  const named = checkPcbTraceStyle(circuitJson, enabled)
  expect(named[0].message).toContain("R_GPIO2.pin2 to J_HAT.GPIO2")
  const copperOnly = circuitJson.filter(
    (e) => e.type === "pcb_trace" || e.type === "pcb_board",
  )
  const unnamed = checkPcbTraceStyle(copperOnly, enabled)
  expect(unnamed[0].message).toContain("unnamed trace")
  for (const warning of [...named, ...unnamed]) {
    expect(warning.message).not.toMatch(
      /\b(?:pcb|source|schematic|subcircuit)_[a-z0-9_]+\b/i,
    )
    expect(warning.message).toContain("tolerance 4°")
  }
})

test("routing and all-check entrypoints propagate the opt-in setting", async () => {
  for (const run of [runAllRoutingChecks, runAllChecks]) {
    const defaultResults = await run(structuredClone(circuitJson))
    expect(
      defaultResults.filter((w) => w.type === "pcb_trace_style_warning"),
    ).toEqual([])
    const enabledResults = await run(structuredClone(circuitJson), {
      projectConfig: { pcbStyleChecksEnabled: true },
    })
    expect(
      enabledResults.filter((w) => w.type === "pcb_trace_style_warning"),
    ).toHaveLength(2)
  }
}, 30_000)
