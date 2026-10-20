import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbTrace,
  PcbTraceRoutePointWire,
} from "circuit-json"
import { checkPcbTraceMinWidth } from "../../lib/check-pcb-trace-min-width"
import { containsCircuitJsonId } from "../../lib/util/get-readable-names"

const board = (props: Partial<PcbBoard> = {}): PcbBoard => ({
  type: "pcb_board",
  pcb_board_id: "board1",
  center: { x: 0, y: 0 },
  width: 20,
  height: 10,
  thickness: 1.6,
  num_layers: 2,
  material: "fr4",
  ...props,
})

const wire = (
  x: number,
  y: number,
  width: number,
  props: Partial<PcbTraceRoutePointWire> = {},
): PcbTraceRoutePointWire => ({
  route_type: "wire",
  x,
  y,
  width,
  layer: "top",
  ...props,
})

const trace = (
  pcb_trace_id: string,
  route: PcbTrace["route"],
  props: Partial<PcbTrace> = {},
): PcbTrace => ({
  type: "pcb_trace",
  pcb_trace_id,
  route,
  ...props,
})

test("checkPcbTraceMinWidth reports traces below the board's min_trace_width (#5559)", () => {
  const circuitJson: AnyCircuitElement[] = [
    board({ min_trace_width: 0.15 }),
    trace("thin", [wire(0, 0, 0.05), wire(4, 0, 0.05)]),
    trace("at_minimum", [wire(0, 2, 0.15), wire(4, 2, 0.15)]),
    trace("wide", [wire(0, 4, 0.3), wire(4, 4, 0.3)]),
  ]

  const errors = checkPcbTraceMinWidth(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_trace_error",
    error_type: "pcb_trace_error",
    pcb_trace_id: "thin",
    center: { x: 2, y: 0 },
    message:
      "Unnamed trace at (2.00mm, 0.00mm) is 0.05mm wide, below the minimum trace width of 0.15mm",
  })
  expect(containsCircuitJsonId(errors[0].message)).toBe(false)
})

test("checkPcbTraceMinWidth reports the narrowest segment once per trace", () => {
  const errors = checkPcbTraceMinWidth([
    board({ min_trace_width: 0.15 }),
    trace("necked", [
      wire(0, 0, 0.12),
      wire(2, 0, 0.08),
      wire(4, 0, 0.3),
      wire(6, 0, 0.3),
    ]),
  ])

  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("is 0.08mm wide")
  expect(errors[0].center).toEqual({ x: 3, y: 0 })
})

test("checkPcbTraceMinWidth falls back to the JLCPCB minimum without a board rule", () => {
  const errors = checkPcbTraceMinWidth([
    trace("jlc_ok", [wire(0, 0, 0.1), wire(4, 0, 0.1)]),
    trace("jlc_thin", [wire(0, 2, 0.08), wire(4, 2, 0.08)]),
  ])

  expect(errors.map((error) => error.pcb_trace_id)).toEqual(["jlc_thin"])
  expect(errors[0].message).toContain("minimum trace width of 0.1mm")
})

test("checkPcbTraceMinWidth reports only the thin part of an interpolated taper", () => {
  const errors = checkPcbTraceMinWidth([
    board({ min_trace_width: 0.15 }),
    trace("taper", [wire(0, 0, 0.35), wire(4, 0, 0.05)], {
      route_thickness_mode: "interpolated",
    }),
  ])

  // Width crosses 0.15mm at x = 8/3, so the marker sits midway to x = 4
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("is 0.05mm wide")
  expect(errors[0].center!.x).toBeCloseTo(10 / 3, 10)
})

test("checkPcbTraceMinWidth ignores copper inside the endpoint pad, but not an escape", () => {
  const pad: AnyCircuitElement = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad1",
    pcb_port_id: "port1",
    shape: "rect",
    x: 0,
    y: 0,
    width: 1,
    height: 0.6,
    layer: "top",
  }

  // 0.05mm only while inside the 1mm pad, full width after it
  const insidePadOnly = checkPcbTraceMinWidth([
    board({ min_trace_width: 0.15 }),
    pad,
    trace("inside_pad", [
      wire(0, 0, 0.05, { start_pcb_port_id: "port1" }),
      wire(0.4, 0, 0.2),
      wire(4, 0, 0.2),
    ]),
  ])
  expect(insidePadOnly).toEqual([])

  // The same neckdown continuing 0.6mm past the pad edge must be fabricated
  const escape = checkPcbTraceMinWidth([
    board({ min_trace_width: 0.15 }),
    pad,
    trace("escape", [
      wire(0, 0, 0.05, { start_pcb_port_id: "port1" }),
      wire(1.1, 0, 0.2),
      wire(4, 0, 0.2),
    ]),
  ])
  expect(escape).toHaveLength(1)
  expect(escape[0].center!.x).toBeCloseTo(0.8, 10)
  expect(escape[0].pcb_port_ids).toEqual(["port1"])
})

test("checkPcbTraceMinWidth uses the rules of the board that owns each trace", () => {
  const errors = checkPcbTraceMinWidth([
    board({
      pcb_board_id: "strict",
      subcircuit_id: "subcircuit_strict",
      min_trace_width: 0.2,
    }),
    board({
      pcb_board_id: "lenient",
      subcircuit_id: "subcircuit_lenient",
      center: { x: 30, y: 0 },
      min_trace_width: 0.1,
    }),
    trace("strict_trace", [wire(0, 0, 0.15), wire(4, 0, 0.15)], {
      subcircuit_id: "subcircuit_strict",
    }),
    trace("lenient_trace", [wire(30, 0, 0.15), wire(34, 0, 0.15)], {
      subcircuit_id: "subcircuit_lenient",
    }),
  ])

  expect(errors.map((error) => error.pcb_trace_id)).toEqual(["strict_trace"])
  expect(errors[0].subcircuit_id).toBe("subcircuit_strict")
})

test("checkPcbTraceMinWidth ignores vias and layer changes between points", () => {
  const errors = checkPcbTraceMinWidth([
    board({ min_trace_width: 0.15 }),
    trace("via_trace", [
      wire(0, 0, 0.2),
      wire(2, 0, 0.2),
      {
        route_type: "via",
        x: 2,
        y: 0,
        from_layer: "top",
        to_layer: "bottom",
      },
      wire(2, 0, 0.2, { layer: "bottom" }),
      wire(4, 0, 0.2, { layer: "bottom" }),
    ]),
  ])

  expect(errors).toEqual([])
  expect(
    checkPcbTraceMinWidth([trace("t", [wire(0, 0, 0.2), wire(4, 0, 0.2)])], {
      minTraceWidth: 0.25,
    }),
  ).toHaveLength(1)
})
