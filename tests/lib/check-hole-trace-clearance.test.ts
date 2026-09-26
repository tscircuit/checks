import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbHole, PcbTrace } from "circuit-json"
import { checkHoleTraceClearance } from "../../index"
import { checkEachPcbTraceNonOverlapping } from "../../index"

test("trace-to-hole clearance uses the drill edge and copper width on every layer", () => {
  const shapes: PcbHole[] = [
    {
      type: "pcb_hole",
      pcb_hole_id: "hole",
      x: 0,
      y: 0,
      hole_shape: "circle",
      hole_diameter: 2,
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "hole",
      x: 0,
      y: 0,
      hole_shape: "square",
      hole_diameter: 2,
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "hole",
      x: 0,
      y: 0,
      hole_shape: "rect",
      hole_width: 3,
      hole_height: 2,
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "hole",
      x: 0,
      y: 0,
      hole_shape: "oval",
      hole_width: 3,
      hole_height: 2,
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "hole",
      x: 0,
      y: 0,
      hole_shape: "pill",
      hole_width: 3,
      hole_height: 2,
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "hole",
      x: 0,
      y: 0,
      hole_shape: "rotated_pill",
      hole_width: 2,
      hole_height: 3,
      ccw_rotation: 90,
    },
  ]
  for (const hole of shapes) {
    for (const layer of ["top", "bottom", "inner1"] as const) {
      const trace: PcbTrace = {
        type: "pcb_trace",
        pcb_trace_id: "trace",
        source_trace_id: "source",
        route: [
          { route_type: "wire", x: -3, y: 1.3, width: 0.2, layer },
          { route_type: "wire", x: 3, y: 1.3, width: 0.2, layer },
        ],
      }
      const circuit: AnyCircuitElement[] = [hole, trace]
      expect(checkHoleTraceClearance(circuit)).toHaveLength(0)
      for (const point of trace.route) {
        if (point.route_type === "wire" || point.route_type === "via")
          point.y = 1.299
      }
      expect(checkHoleTraceClearance(circuit)).toHaveLength(1)
      expect(checkEachPcbTraceNonOverlapping(circuit)).toHaveLength(1)
      expect(
        checkHoleTraceClearance(circuit, { minClearance: 0.1 }),
      ).toHaveLength(0)
      trace.route[1] = {
        route_type: "via",
        x: 3,
        y: 1.299,
        from_layer: layer,
        to_layer: "bottom",
      }
      expect(checkHoleTraceClearance(circuit)).toHaveLength(1)
      for (const point of trace.route) {
        if (point.route_type === "wire" || point.route_type === "via")
          point.y = 0
      }
      expect(
        checkHoleTraceClearance(circuit, { minClearance: 0 }),
      ).toHaveLength(1)
    }
  }
  const board: AnyCircuitElement = {
    type: "pcb_board",
    pcb_board_id: "board",
    center: { x: 0, y: 0 },
    width: 10,
    height: 10,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
    min_trace_to_hole_edge_clearance: 0.4,
    min_trace_to_pad_edge_clearance: 0.05,
  }
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace",
    source_trace_id: "source",
    route: [
      { route_type: "wire", x: -3, y: 1.4, width: 0.2, layer: "top" },
      { route_type: "wire", x: 3, y: 1.4, width: 0.2, layer: "top" },
    ],
  }
  expect(checkHoleTraceClearance([board, shapes[0]!, trace])).toHaveLength(1)
  expect(
    checkHoleTraceClearance([board, shapes[0]!, trace], {
      minClearance: 0.2,
    }),
  ).toHaveLength(0)
  expect(() => checkHoleTraceClearance([], { minClearance: -0.2 })).toThrow()
})
