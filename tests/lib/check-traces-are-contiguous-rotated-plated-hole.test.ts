import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"

test("trace endpoint in a rotated plated-hole rect pad is contiguous", () => {
  const circuitJson = [
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
      x: 2,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pcb_plated_hole_1",
      pcb_port_id: "pcb_port_1",
      shape: "rotated_pill_hole_with_rect_pad",
      hole_shape: "rotated_pill",
      pad_shape: "rect",
      hole_width: 0.4,
      hole_height: 0.8,
      hole_ccw_rotation: 90,
      rect_pad_width: 1.2,
      rect_pad_height: 0.8,
      rect_ccw_rotation: 90,
      hole_offset_x: 0,
      hole_offset_y: 0,
      x: 0,
      y: 0,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_2",
      pcb_port_id: "pcb_port_2",
      shape: "rect",
      x: 2,
      y: 0,
      width: 0.4,
      height: 0.4,
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_1",
      source_trace_id: "source_trace_1",
      route: [
        {
          route_type: "wire",
          x: 0,
          y: 0.5,
          width: 0.1,
          layer: "top",
          start_pcb_port_id: "pcb_port_1",
        },
        {
          route_type: "wire",
          x: 2,
          y: 0,
          width: 0.1,
          layer: "top",
          end_pcb_port_id: "pcb_port_2",
        },
      ],
    },
  ] as AnyCircuitElement[]

  expect(checkTracesAreContiguous(circuitJson)).toEqual([])
})
