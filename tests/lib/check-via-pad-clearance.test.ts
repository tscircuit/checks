import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkViaPadClearance } from "../../lib/check-via-pad-clearance"

test("checkViaPadClearance reports an escape via too close to an unrelated fine-pitch pad", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "source_pad",
      shape: "rect",
      x: 0,
      y: 0,
      width: 0.65,
      height: 0.15,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "upper_neighbor_pad",
      shape: "rect",
      x: 0,
      y: 0.35,
      width: 0.65,
      height: 0.15,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "lower_neighbor_pad",
      shape: "rect",
      x: 0,
      y: -0.35,
      width: 0.65,
      height: 0.15,
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "escape_trace",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.15, layer: "top" },
        {
          route_type: "wire",
          x: -0.45,
          y: 0,
          width: 0.15,
          layer: "top",
        },
      ],
    },
    {
      type: "pcb_via",
      pcb_via_id: "escape_via",
      pcb_trace_id: "escape_trace",
      x: -0.45,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      layers: ["top", "inner1"],
    },
  ]

  const errors = checkViaPadClearance(circuitJson, {
    connMap: {
      areIdsConnected: (a: string, b: string) =>
        [a, b].includes("escape_via") && [a, b].includes("source_pad"),
    } as any,
  })

  const svg = convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
    shouldDrawErrors: true,
    showErrorsInTextOverlay: true,
  })

  expect(errors).toHaveLength(2)
  expect(errors.map((error) => error.pcb_pad_ids)).toEqual([
    ["escape_via", "lower_neighbor_pad"],
    ["escape_via", "upper_neighbor_pad"],
  ])
  expect(errors.every((error) => error.minimum_clearance === 0.1)).toBe(true)
  expect(
    errors.every(
      (error) =>
        error.actual_clearance !== undefined &&
        Math.abs(error.actual_clearance - 0.002076) < 1e-5,
    ),
  ).toBe(true)

  expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test("checkViaPadClearance reports violations within 5um below minimum clearance and honors exact boundaries", () => {
  const makeCircuit = (viaX: number): AnyCircuitElement[] => [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_a",
      shape: "rect",
      x: 0,
      y: 0,
      width: 0.6,
      height: 0.6,
      layer: "top",
    },
    {
      type: "pcb_via",
      pcb_via_id: "via_a",
      x: viaX,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      layers: ["top", "bottom"],
    },
  ]

  // Pad right edge is at x = 0.3; via copper radius is 0.3.
  // At x = 0.6973 the gap is 0.0973mm (< 0.1mm by 2.7um).
  const sub5umErrors = checkViaPadClearance(makeCircuit(0.6973), {
    minClearance: 0.1,
  })
  expect(sub5umErrors).toHaveLength(1)
  expect(sub5umErrors[0]?.pcb_pad_ids).toEqual(["via_a", "pad_a"])
  expect(sub5umErrors[0]?.actual_clearance).toBeCloseTo(0.0973, 6)
  expect(sub5umErrors[0]?.message).not.toMatch(/\b(?:via_a|pad_a)\b/)

  // At x = 0.699 the gap is 0.099mm (< 0.1mm by 1um).
  const sub1umErrors = checkViaPadClearance(makeCircuit(0.699), {
    minClearance: 0.1,
  })
  expect(sub1umErrors).toHaveLength(1)
  expect(sub1umErrors[0]?.actual_clearance).toBeCloseTo(0.099, 6)

  // At x = 0.7 the exact gap is 0.1mm (0.7 - 0.3 - 0.3 = 0.09999999999999998 in IEEE-754).
  expect(checkViaPadClearance(makeCircuit(0.7), { minClearance: 0.1 })).toEqual(
    [],
  )

  // A small positive clearance requirement (< 0.005mm) still flags touching copper.
  expect(
    checkViaPadClearance(makeCircuit(0.6), { minClearance: 0.003 }),
  ).toHaveLength(1)

  // When minimum clearance is 0, a -0.002mm pill-pad copper overlap must still be reported.
  const pillOverlapErrors = checkViaPadClearance(
    [
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pill_pad",
        shape: "pill",
        x: 0,
        y: 0,
        width: 1.2,
        height: 0.6,
        radius: 0.3,
        layer: "top",
      },
      {
        type: "pcb_via",
        pcb_via_id: "via_a",
        x: 0.898,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ],
    { minClearance: 0 },
  )
  expect(pillOverlapErrors).toHaveLength(1)
  expect(pillOverlapErrors[0]?.actual_clearance).toBeCloseTo(-0.002, 6)
})
