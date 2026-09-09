import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbSmtPad } from "circuit-json"
import { checkPadTraceClearance } from "../../lib/check-pad-trace-clearance"
import { checkViaPadClearance } from "../../lib/check-via-pad-clearance"

for (const shape of [
  "rect",
  "circle",
  "pill",
  "rotated_rect",
  "rotated_pill",
  "polygon",
] as const) {
  test(`via-${shape} marker lies halfway between the nearest copper edges`, () => {
    const pad = {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad",
      layer: "top",
      x: 0,
      y: 0,
      shape,
      width: 4,
      height: shape === "rotated_rect" || shape === "rotated_pill" ? 2 : 4,
      radius: shape === "rotated_pill" ? 1 : 2,
      ccw_rotation: 90,
      points: [
        { x: -2, y: -2 },
        { x: 2, y: -2 },
        { x: 2, y: 2 },
        { x: -2, y: 2 },
      ],
    } as PcbSmtPad
    const circuit: AnyCircuitElement[] = [
      pad,
      {
        type: "pcb_via",
        pcb_via_id: "via",
        x: 0,
        y: -2.3,
        outer_diameter: 0.5,
        hole_diameter: 0.2,
        layers: ["top", "bottom"],
      },
    ]
    const [error] = checkViaPadClearance(circuit)
    // Pad edge y=-2, via edge y=-2.05: 0.05mm gap, center y=-2.025.
    expect(error.actual_clearance).toBeCloseTo(0.05, 10)
    expect(error.center!.x).toBeCloseTo(0, 10)
    expect(error.center!.y).toBeCloseTo(-2.025, 10)
  })
}

for (const [viaY, expectedY] of [
  [-2.1, -2],
  [0, 0],
]) {
  test(`via-pad overlap at y=${viaY} places marker inside both copper shapes`, () => {
    const [error] = checkViaPadClearance([
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad",
        shape: "rect",
        x: 0,
        y: 0,
        width: 4,
        height: 4,
        layer: "top",
      },
      {
        type: "pcb_via",
        pcb_via_id: "via",
        x: 0,
        y: viaY,
        outer_diameter: 0.5,
        hole_diameter: 0.2,
        layers: ["top", "bottom"],
      },
    ])
    expect(error.center!.x).toBeCloseTo(0, 10)
    expect(error.center!.y).toBeCloseTo(expectedY, 10)
    expect(Math.abs(error.center!.y! - viaY)).toBeLessThanOrEqual(0.25)
    expect(Math.abs(error.center!.y!)).toBeLessThanOrEqual(2)
  })
}

test("extending a trace far beyond the violation does not move its marker", () => {
  const circuit: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad",
      shape: "circle",
      x: 0,
      y: 0,
      radius: 0.5,
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace",
      route: [
        { route_type: "wire", x: -1, y: 0.625, width: 0.1, layer: "top" },
        { route_type: "wire", x: 1, y: 0.625, width: 0.1, layer: "top" },
      ],
    },
  ]
  const [before] = checkPadTraceClearance(circuit)
  const trace = circuit[1]
  if (trace.type !== "pcb_trace") throw new Error("Expected trace")
  trace.route.push({
    route_type: "wire",
    x: 40,
    y: 40,
    width: 0.1,
    layer: "top",
  })
  const [after] = checkPadTraceClearance(circuit)
  expect(after).toEqual(before)
  expect(after.center!.x).toBeCloseTo(0, 10)
  expect(after.center!.y).toBeCloseTo(0.5375, 10)
})

for (const [padRadius, viaRadius, viaX] of [
  [2, 0.25, 0.1],
  [0.1, 2, 0.1],
]) {
  test(`contained circular copper keeps marker inside both shapes (${padRadius}, ${viaRadius})`, () => {
    const [error] = checkViaPadClearance([
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad",
        shape: "circle",
        x: 0,
        y: 0,
        radius: padRadius,
        layer: "top",
      },
      {
        type: "pcb_via",
        pcb_via_id: "via",
        x: viaX,
        y: 0,
        outer_diameter: viaRadius * 2,
        hole_diameter: 0.05,
        layers: ["top", "bottom"],
      },
    ])
    expect(Math.abs(error.center!.x!)).toBeLessThanOrEqual(padRadius)
    expect(Math.abs(error.center!.x! - viaX)).toBeLessThanOrEqual(viaRadius)
    expect(error.center!.y).toBe(0)
  })
}
