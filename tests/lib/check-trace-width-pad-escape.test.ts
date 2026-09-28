import { expect, test } from "bun:test"
import { checkSourceTracesMatchPcbTraceThickness as check } from "lib/check-source-traces-match-pcb-trace-thickness"
import {
  shortPadTaper,
  longPadEscape,
  middleBottleneck,
  padEscapeFixture,
} from "../fixtures/trace-width-pad-escape"

test("short tapers at both connected endpoint pads are allowed", () => {
  expect(check(shortPadTaper())).toEqual([])
})
test("long endpoint narrowing warns beyond the pad escape allowance", () => {
  const warnings = check(longPadEscape())
  expect(warnings).toHaveLength(1)
  expect(warnings[0].center).toEqual({ x: 2.625, y: 0 })
})
test("short pad escapes do not hide an interior bottleneck", () => {
  expect(check(middleBottleneck())[0].center).toEqual({ x: 10, y: 0 })
})
test("subdividing a narrow run cannot renew the escape budget", () => {
  const circuit = padEscapeFixture([
    [0, 0, 0.3],
    [0.5, 0, 0.3],
    [1, 0, 0.3],
    [1.5, 0, 0.3],
    [2, 0, 1],
    [20, 0, 1],
  ])
  expect(check(circuit)[0].center).toEqual({ x: 1.375, y: 0 })
})
test("route length, not proximity, limits a winding pad escape", () => {
  const circuit = padEscapeFixture([
    [0, 0, 0.3],
    [0.5, 0, 0.3],
    [0.5, 0.5, 0.3],
    [0.5, 0, 0.3],
    [1.25, 0, 1],
    [20, 0, 1],
  ])
  expect(check(circuit)[0].center).toEqual({ x: 0.5, y: 0.125 })
})
test("unrelated or opposite-layer pads do not exempt endpoint narrowing", () => {
  for (const mismatch of ["port", "layer", "position"]) {
    const circuit = shortPadTaper()
    for (const pad of circuit.filter((e) => e.type === "pcb_smtpad")) {
      if (mismatch === "port") pad.pcb_port_id = "unrelated"
      if (mismatch === "layer") pad.layer = "bottom"
      if (mismatch === "position" && "y" in pad) pad.y += 5
    }
    expect(check(circuit)).toHaveLength(1)
  }
})
test("a pad in the middle of the route does not hide a bottleneck", () => {
  const circuit = middleBottleneck()
  circuit.push({
    type: "pcb_smtpad",
    pcb_smtpad_id: "middle",
    pcb_component_id: "middle",
    pcb_port_id: "pcb_port_0",
    shape: "rect",
    x: 10,
    y: 0,
    width: 6,
    height: 2,
    layer: "top",
  })
  expect(check(circuit)[0].center).toEqual({ x: 10, y: 0 })
})
test("a zero escape budget allows only copper within the endpoint pad", () => {
  expect(check(shortPadTaper(), { maxPadNeckdownLength: 0 })).toHaveLength(1)
  for (const invalid of [-1, Infinity, NaN]) {
    expect(() =>
      check(shortPadTaper(), { maxPadNeckdownLength: invalid }),
    ).toThrow()
  }
})

test("rotated pad uses its copper edge rather than its bounding box", () => {
  const circuit = longPadEscape()
  const padIndex = circuit.findIndex((e) => e.type === "pcb_smtpad")
  const pad = circuit[padIndex]
  if (pad.type !== "pcb_smtpad" || pad.shape !== "rect")
    throw new Error("Missing pad")
  circuit[padIndex] = { ...pad, shape: "rotated_rect", ccw_rotation: 45 }
  // The 0.5 mm wide rotated pad exits x at sqrt(2)/4, not its AABB edge.
  const warnings = check(circuit)
  expect(warnings[0].center!.x).toBeCloseTo((Math.SQRT2 / 4 + 1 + 4) / 2)
})

test("reversing route direction preserves short endpoint exemptions", () => {
  const circuit = shortPadTaper()
  const trace = circuit.find((e) => e.type === "pcb_trace")!
  trace.route.reverse()
  for (const point of trace.route) {
    if (point.route_type !== "wire") continue
    const start = point.start_pcb_port_id
    point.start_pcb_port_id = point.end_pcb_port_id
    point.end_pcb_port_id = start
  }
  expect(check(circuit)).toEqual([])
})
