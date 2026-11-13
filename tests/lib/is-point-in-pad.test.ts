import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbPlatedHole } from "circuit-json"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { isPointInPad } from "lib/check-traces-are-contiguous/is-point-in-pad"

test("isPointInPad supports hole_with_polygon_pad plated holes", () => {
  const polygonPlatedHole: PcbPlatedHole = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "ph_polygon",
    pcb_port_id: "pcb_port_1",
    shape: "hole_with_polygon_pad",
    hole_shape: "circle",
    hole_diameter: 0.8,
    hole_offset_x: 0,
    hole_offset_y: 0,
    x: 5,
    y: 10,
    layers: ["top", "bottom"],
    pad_outline: [
      { x: -1, y: -0.5 },
      { x: 1.5, y: -0.5 },
      { x: 1.5, y: 0.5 },
      { x: 0.5, y: 1.2 },
      { x: -1, y: 0.5 },
    ],
  }

  expect(isPointInPad({ x: 5, y: 10 }, polygonPlatedHole)).toBe(true)
  expect(isPointInPad({ x: 6.2, y: 10.2 }, polygonPlatedHole)).toBe(true)
  expect(isPointInPad({ x: 5.5, y: 11.0 }, polygonPlatedHole)).toBe(true)
  // Outside the sloped polygon edge even though inside its bounding box
  expect(isPointInPad({ x: 6.4, y: 11.1 }, polygonPlatedHole)).toBe(false)
  expect(isPointInPad({ x: 3.5, y: 10 }, polygonPlatedHole)).toBe(false)
})

test("isPointInPad respects ccw_rotation and capsule/ellipse geometry on pill and oval plated holes", () => {
  const rotatedPillHole: PcbPlatedHole = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "ph_pill",
    shape: "pill",
    outer_width: 3,
    outer_height: 1,
    hole_width: 2,
    hole_height: 0.5,
    ccw_rotation: 90,
    x: 0,
    y: 0,
    layers: ["top", "bottom"],
  }

  // Rotated 90deg: spans y in [-1.5, 1.5] and x in [-0.5, 0.5]
  expect(isPointInPad({ x: 0, y: 1.2 }, rotatedPillHole)).toBe(true)
  expect(isPointInPad({ x: 1.2, y: 0 }, rotatedPillHole)).toBe(false)
  // Outside rounded capsule cap corner (0.45^2 + 0.45^2 > 0.5^2)
  expect(isPointInPad({ x: 0.45, y: 1.45 }, rotatedPillHole)).toBe(false)

  const rotatedOvalHole: PcbPlatedHole = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "ph_oval",
    shape: "oval",
    outer_width: 4,
    outer_height: 1.2,
    hole_width: 2.5,
    hole_height: 0.6,
    ccw_rotation: 90,
    x: 2,
    y: 3,
    layers: ["top", "bottom"],
  }

  // Rotated 90deg around (2, 3): major axis is along Y (radius 2), minor along X (radius 0.6)
  expect(isPointInPad({ x: 2, y: 4.8 }, rotatedOvalHole)).toBe(true)
  expect(isPointInPad({ x: 3.8, y: 3 }, rotatedOvalHole)).toBe(false)
  // Outside ellipse boundary even though inside bounding box [-0.6, 0.6] x [-2, 2]
  expect(isPointInPad({ x: 2.55, y: 4.8 }, rotatedOvalHole)).toBe(false)
})

test("isPointInPad respects rect_pad_offset_x and rect_pad_offset_y on rect-pad plated holes", () => {
  const offsetRectPadHole: PcbPlatedHole & {
    rect_pad_offset_x?: number
    rect_pad_offset_y?: number
  } = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "ph_rect_offset",
    shape: "circular_hole_with_rect_pad",
    hole_shape: "circle",
    pad_shape: "rect",
    hole_diameter: 0.8,
    hole_offset_x: 0,
    hole_offset_y: 0,
    rect_pad_width: 1.6,
    rect_pad_height: 1.0,
    rect_pad_offset_x: 1.2,
    rect_pad_offset_y: -0.6,
    x: 0,
    y: 0,
    layers: ["top", "bottom"],
  }

  // Offset pad center is at (1.2, -0.6), extending x in [0.4, 2.0], y in [-1.1, -0.1]
  expect(isPointInPad({ x: 1.8, y: -0.6 }, offsetRectPadHole)).toBe(true)
  expect(isPointInPad({ x: -0.6, y: 0 }, offsetRectPadHole)).toBe(false)
})

test("checkTracesAreContiguous accepts interpolated trace endpoint inside hole_with_polygon_pad", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_port",
      source_port_id: "source_port_1",
      name: "1",
      pin_number: 1,
      port_hints: ["1"],
    },
    {
      type: "source_port",
      source_port_id: "source_port_2",
      name: "2",
      pin_number: 2,
      port_hints: ["2"],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_1",
      connected_source_port_ids: ["source_port_1", "source_port_2"],
      connected_source_net_ids: [],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_1",
      source_port_id: "source_port_1",
      x: 0,
      y: 0,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_2",
      source_port_id: "source_port_2",
      x: 4,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pcb_plated_hole_1",
      pcb_port_id: "pcb_port_1",
      shape: "hole_with_polygon_pad",
      hole_shape: "circle",
      hole_diameter: 0.8,
      hole_offset_x: 0,
      hole_offset_y: 0,
      x: 0,
      y: 0,
      layers: ["top", "bottom"],
      pad_outline: [
        { x: -0.8, y: -0.8 },
        { x: 1.6, y: -0.8 },
        { x: 1.6, y: 0.8 },
        { x: -0.8, y: 0.8 },
      ],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_2",
      pcb_port_id: "pcb_port_2",
      shape: "rect",
      x: 4,
      y: 0,
      width: 0.6,
      height: 0.6,
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_1",
      source_trace_id: "source_trace_1",
      route_thickness_mode: "interpolated",
      route: [
        {
          route_type: "wire",
          x: 1.2,
          y: 0,
          width: 0.2,
          layer: "top",
          start_pcb_port_id: "pcb_port_1",
        },
        {
          route_type: "wire",
          x: 4,
          y: 0,
          width: 0.2,
          layer: "top",
          end_pcb_port_id: "pcb_port_2",
        },
      ],
    },
  ]

  expect(checkTracesAreContiguous(circuitJson)).toEqual([])
})
