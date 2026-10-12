import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbTraceAcuteAngles } from "lib/check-pcb-trace-acute-angles"
import { runAllChecks, runAllRoutingChecks } from "lib/run-all-checks"

test("normal 90-degree and 45-degree bends pass with no errors", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 50,
      height: 50,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_trace_acute_angle: 80,
    } as any,
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_normal",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
        { route_type: "wire", x: 5, y: 0, width: 0.2, layer: "top" },
        { route_type: "wire", x: 5, y: 5, width: 0.2, layer: "top" },
        { route_type: "wire", x: 8, y: 8, width: 0.2, layer: "top" },
      ],
    },
  ]

  const errors = checkPcbTraceAcuteAngles(circuitJson)
  expect(errors).toHaveLength(0)
})

test("reproduces issue #5559: detects acute 31-degree bend at vertex (5, 2.5)", () => {
  // From issue #5559:
  // Route: (0.825, 0) -> (5, 2.5) -> (3.6, 2.5)
  // Bends through about 31° at (5, 2.5)
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 50,
      height: 50,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_trace_acute_angle: 80,
    } as any,
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_acute",
      source_trace_id: "source_trace_1",
      route: [
        { route_type: "wire", x: 0.825, y: 0, width: 0.15, layer: "top" },
        { route_type: "wire", x: 5, y: 2.5, width: 0.15, layer: "top" },
        { route_type: "wire", x: 3.6, y: 2.5, width: 0.15, layer: "top" },
      ],
    },
  ]

  const errors = checkPcbTraceAcuteAngles(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].type).toBe("pcb_trace_warning")
  expect(errors[0].center).toEqual({ x: 5, y: 2.5 })
  expect(errors[0].message).toContain("30.9°")
  expect(errors[0].message).toContain("below the minimum allowed angle (80°)")
  expect(errors[0].message).toContain("acid trap defect")
})

test("detects hairpin reversal bend (< 10 degrees) with config override", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_hairpin",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
        { route_type: "wire", x: 10, y: 0, width: 0.2, layer: "top" },
        { route_type: "wire", x: 1, y: 0.1, width: 0.2, layer: "top" },
      ],
    },
  ]

  const errors = checkPcbTraceAcuteAngles(circuitJson, { minAngleDegrees: 80 })
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("below the minimum allowed angle (80°)")
})

test("ignores bends on different layers across via transitions", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_multi_layer",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
        { route_type: "wire", x: 5, y: 2.5, width: 0.2, layer: "top" },
        { route_type: "wire", x: 3.6, y: 2.5, width: 0.2, layer: "bottom" },
      ],
    },
  ]

  const errors = checkPcbTraceAcuteAngles(circuitJson, { minAngleDegrees: 80 })
  expect(errors).toHaveLength(0)
})

test("respects configurable minAngleDegrees override", () => {
  // 60-degree angle between segments
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_60deg",
      route: [
        { route_type: "wire", x: 1, y: 0, width: 0.2, layer: "top" },
        { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
        {
          route_type: "wire",
          x: 0.5,
          y: Math.sqrt(3) / 2,
          width: 0.2,
          layer: "top",
        },
      ],
    },
  ]

  // With minAngleDegrees = 80°, flags it
  expect(
    checkPcbTraceAcuteAngles(circuitJson, { minAngleDegrees: 80 }),
  ).toHaveLength(1)

  // With minAngleDegrees = 45°, 60° passes
  expect(
    checkPcbTraceAcuteAngles(circuitJson, { minAngleDegrees: 45 }),
  ).toHaveLength(0)
})

test("is included in runAllRoutingChecks and runAllChecks when board specifies min_trace_acute_angle", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 50,
      height: 50,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_trace_acute_angle: 80,
    } as any,
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_acute",
      route: [
        { route_type: "wire", x: 0.825, y: 0, width: 0.15, layer: "top" },
        { route_type: "wire", x: 5, y: 2.5, width: 0.15, layer: "top" },
        { route_type: "wire", x: 3.6, y: 2.5, width: 0.15, layer: "top" },
      ],
    },
  ]

  const routingErrors = await runAllRoutingChecks(circuitJson)
  expect(routingErrors.some((e) => e.message.includes("30.9°"))).toBe(true)

  const allErrors = await runAllChecks(circuitJson)
  expect(allErrors.some((e) => e.message.includes("30.9°"))).toBe(true)
})
