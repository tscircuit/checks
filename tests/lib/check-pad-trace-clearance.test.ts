import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPadTraceClearance } from "../../lib/check-pad-trace-clearance"

test("checkPadTraceClearance reports pad and trace closer than 0.2mm", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "rect",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      route: [
        { route_type: "wire", x: -1, y: 0.625, width: 0.1, layer: "top" },
        { route_type: "wire", x: 1, y: 0.625, width: 0.1, layer: "top" },
      ],
    },
  ]

  const errors = checkPadTraceClearance(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].type).toBe("pcb_pad_trace_clearance_error")
  expect(errors[0].pcb_pad_id).toBe("pad1")
  expect(errors[0].pcb_trace_id).toBe("trace1")
  expect(errors[0].minimum_clearance).toBe(0.1)
  expect(errors[0].actual_clearance).toBeCloseTo(0.075, 10)
  expect(errors[0]!.center!.y).toBeCloseTo(0.5375, 10)
})

test("centers circular pad clearance errors between the copper edges", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pad1",
      shape: "circle",
      x: 0,
      y: 0,
      outer_diameter: 1,
      hole_diameter: 0.5,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      route: [
        { route_type: "wire", x: -1, y: 0.625, width: 0.1, layer: "top" },
        { route_type: "wire", x: 1, y: 0.625, width: 0.1, layer: "top" },
      ],
    },
  ]

  const errors = checkPadTraceClearance(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].actual_clearance).toBeCloseTo(0.075, 10)
  expect(errors[0]!.center!.x).toBeCloseTo(0, 10)
  expect(errors[0]!.center!.y).toBeCloseTo(0.5375, 10)
})

test("checkPadTraceClearance deduplicates multiple close segments for one pad-trace pair", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "rect",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      route: [
        { route_type: "wire", x: -1, y: 0.69, width: 0.1, layer: "top" },
        { route_type: "wire", x: 1, y: 0.69, width: 0.1, layer: "top" },
        { route_type: "wire", x: 1, y: 0.625, width: 0.1, layer: "top" },
        { route_type: "wire", x: -1, y: 0.625, width: 0.1, layer: "top" },
      ],
    },
  ]

  const errors = checkPadTraceClearance(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_pad_id).toBe("pad1")
  expect(errors[0].pcb_trace_id).toBe("trace1")
  expect(errors[0].actual_clearance).toBeCloseTo(0.075, 10)
})

test("checkPadTraceClearance ignores rotated pill pad bounding-box false positives", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "rotated_pill",
      x: 0,
      y: 0,
      width: 2,
      height: 0.4,
      radius: 0.2,
      ccw_rotation: 45,
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      route: [
        { route_type: "wire", x: -0.75, y: 0.7, width: 0.1, layer: "top" },
        { route_type: "wire", x: -0.25, y: 0.7, width: 0.1, layer: "top" },
      ],
    },
  ]

  expect(checkPadTraceClearance(circuitJson, { minClearance: 0.1 })).toEqual([])
})

test("checkPadTraceClearance ignores (non-rotated) pill pad bounding-box false positives", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "pill",
      x: 0,
      y: 0,
      width: 2,
      height: 1,
      radius: 0.5,
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      // Near the rounded corner: bounding-box says contact, true pill gap is ~0.115mm.
      route: [
        { route_type: "wire", x: -1.07, y: 0.57, width: 0.1, layer: "top" },
        { route_type: "wire", x: -0.97, y: 0.47, width: 0.1, layer: "top" },
      ],
    },
  ]

  expect(checkPadTraceClearance(circuitJson, { minClearance: 0.1 })).toEqual([])
})

test("checkPadTraceClearance still flags a real (non-rotated) pill pad clearance violation", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "pill",
      x: 0,
      y: 0,
      width: 2,
      height: 1,
      radius: 0.5,
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      // Just above the flat edge (gap ~0.02mm < 0.1mm) -> must still be reported.
      route: [
        { route_type: "wire", x: -0.2, y: 0.57, width: 0.1, layer: "top" },
        { route_type: "wire", x: 0.2, y: 0.57, width: 0.1, layer: "top" },
      ],
    },
  ]

  const errors = checkPadTraceClearance(circuitJson, { minClearance: 0.1 })

  expect(errors).toHaveLength(1)
  expect(errors[0]!.center!.y).toBeCloseTo(0.51, 10)
})
