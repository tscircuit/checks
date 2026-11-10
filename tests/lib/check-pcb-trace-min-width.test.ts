import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbTraceMinWidth } from "lib/check-pcb-trace-min-width"
import { runAllRoutingChecks } from "lib/run-all-checks"

test("reports error when wire segment width is below board min_trace_width", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      width: 20,
      height: 10,
      center: { x: 0, y: 0 },
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_trace_width: 0.15,
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.05, layer: "top" },
        { route_type: "wire", x: 5, y: 0, width: 0.05, layer: "top" },
      ],
    },
  ]

  const errors = checkPcbTraceMinWidth(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].type).toBe("pcb_trace_error")
  expect(errors[0].message).toContain("below the board minimum (0.15mm)")
  expect(errors[0].message).toContain("0.05mm")
  expect(errors[0].center).toEqual({ x: 2.5, y: 0 })
})

test("produces no error when trace width meets board min_trace_width", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      width: 20,
      height: 10,
      center: { x: 0, y: 0 },
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_trace_width: 0.15,
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.15, layer: "top" },
        { route_type: "wire", x: 5, y: 0, width: 0.15, layer: "top" },
      ],
    },
  ]

  const errors = checkPcbTraceMinWidth(circuitJson)
  expect(errors).toHaveLength(0)
})

test("respects config override for minTraceWidth", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      width: 20,
      height: 10,
      center: { x: 0, y: 0 },
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_trace_width: 0.1,
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.15, layer: "top" },
        { route_type: "wire", x: 5, y: 0, width: 0.15, layer: "top" },
      ],
    },
  ]

  // With default board limit (0.1), no errors
  expect(checkPcbTraceMinWidth(circuitJson)).toHaveLength(0)

  // With explicit config override (0.2), should report error
  const errors = checkPcbTraceMinWidth(circuitJson, { minTraceWidth: 0.2 })
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("below the board minimum (0.2mm)")
})

test("interpolated trace reports error when minimum segment width is below board limit", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      width: 20,
      height: 10,
      center: { x: 0, y: 0 },
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_trace_width: 0.15,
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      route_thickness_mode: "interpolated",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
        { route_type: "wire", x: 5, y: 0, width: 0.1, layer: "top" },
      ],
    },
  ]

  const errors = checkPcbTraceMinWidth(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("0.1mm")
})

test("runAllRoutingChecks includes checkPcbTraceMinWidth errors", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      width: 20,
      height: 10,
      center: { x: 0, y: 0 },
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_trace_width: 0.2,
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.1, layer: "top" },
        { route_type: "wire", x: 5, y: 0, width: 0.1, layer: "top" },
      ],
    },
  ]

  const routingErrors = await runAllRoutingChecks(circuitJson)
  const widthErrors = routingErrors.filter(
    (e) =>
      e.type === "pcb_trace_error" &&
      typeof e.message === "string" &&
      e.message.includes("below the board minimum"),
  )
  expect(widthErrors).toHaveLength(1)
})
