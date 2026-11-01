import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement, PcbHole, PcbTrace, PcbVia } from "circuit-json"
import {
  checkEachPcbTraceNonOverlapping,
  checkHoleTraceClearance,
  checkViaTraceClearance,
  runAllRoutingChecks,
} from "../../index"

test("trace-to-hole clearance uses the drill edge and copper width on every layer", async () => {
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
      expect(checkEachPcbTraceNonOverlapping(circuit)).toHaveLength(0)
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
      expect(checkHoleTraceClearance(circuit)).toHaveLength(0)
      expect(checkEachPcbTraceNonOverlapping(circuit)).toHaveLength(1)
      const routingErrors = await runAllRoutingChecks(circuit)
      expect(
        routingErrors.filter(
          (error) =>
            error.type === "pcb_trace_error" &&
            error.pcb_trace_error_id === "overlap_trace_hole",
        ),
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
  // NPTH geometry does not depend on the board's electrical layer stack.
  const multilayerBoard = { ...board, num_layers: 12 }
  expect(checkHoleTraceClearance([multilayerBoard, trace])).toEqual([])
  expect(checkEachPcbTraceNonOverlapping([multilayerBoard, trace])).toEqual([])
  expect(
    checkHoleTraceClearance([multilayerBoard, shapes[0]!, trace]),
  ).toHaveLength(1)

  for (const reversed of [false, true]) {
    const mixedTrace: PcbTrace = {
      ...trace,
      route: [
        { route_type: "wire", x: -2, y: 1.25, width: 0.2, layer: "top" },
        { route_type: "wire", x: 2, y: 1.25, width: 0.2, layer: "top" },
        { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
      ],
    }
    if (reversed) mixedTrace.route.reverse()
    const mixedCircuit = [shapes[0]!, mixedTrace]
    expect(checkHoleTraceClearance(mixedCircuit)).toEqual([])
    expect(checkEachPcbTraceNonOverlapping(mixedCircuit)).toHaveLength(1)
  }

  const snapshotCircuit: AnyCircuitElement[] = [
    {
      ...board,
      width: 8,
      height: 5,
      min_trace_to_hole_edge_clearance: 0.2,
    },
    shapes[0]!,
  ]
  for (const { id, y, gap } of [
    { id: "too_close", y: 1.25, gap: "0.15" },
    { id: "at_minimum", y: -1.3, gap: "0.20" },
  ]) {
    snapshotCircuit.push(
      {
        type: "pcb_trace",
        pcb_trace_id: id,
        route: [
          { route_type: "wire", x: -2, y, width: 0.2, layer: "top" },
          { route_type: "wire", x: 2, y, width: 0.2, layer: "top" },
        ],
      },
      {
        type: "pcb_silkscreen_text",
        pcb_silkscreen_text_id: `label_${id}`,
        pcb_component_id: "",
        anchor_position: { x: 2.2, y },
        anchor_alignment: "center_left",
        font: "tscircuit2024",
        font_size: 0.2,
        layer: "top",
        text: `${gap} mm gap`,
      },
    )
  }
  // The 0.15 mm gap passes the pad rule but violates the independent hole rule.
  const snapshotErrors = checkHoleTraceClearance(snapshotCircuit)
  expect(checkEachPcbTraceNonOverlapping(snapshotCircuit)).toEqual([])
  const routingErrors = await runAllRoutingChecks(snapshotCircuit)
  expect(
    routingErrors.filter(
      (error) =>
        error.type === "pcb_trace_error" &&
        error.pcb_trace_error_id === "overlap_too_close_hole",
    ),
  ).toEqual(snapshotErrors)
  expect(snapshotErrors).toHaveLength(1)
  expect(snapshotErrors[0]).toMatchObject({ pcb_trace_id: "too_close" })
  expect(
    convertCircuitJsonToPcbSvg([...snapshotCircuit, ...snapshotErrors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})

test("checkHoleTraceClearance checks pcb_via drill hole to trace clearance", async () => {
  const via: PcbVia = {
    type: "pcb_via",
    pcb_via_id: "via_1",
    x: 0,
    y: 0,
    outer_diameter: 0.3,
    hole_diameter: 0.2,
    layers: ["top", "bottom"],
  }
  // Trace at y = 0.36 has width 0.2 (half-width 0.1):
  // - copper-to-copper gap = 0.36 - 0.15 - 0.10 = 0.11 mm (>= 0.10 mm pad rule)
  // - drill-hole-to-copper gap = 0.36 - 0.10 - 0.10 = 0.16 mm (< 0.20 mm hole rule)
  const unrelatedTrace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace_unrelated",
    route: [
      { route_type: "wire", x: -2, y: 0.36, width: 0.2, layer: "top" },
      { route_type: "wire", x: 2, y: 0.36, width: 0.2, layer: "top" },
    ],
  }
  const safeTrace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace_safe",
    route: [
      { route_type: "wire", x: -2, y: -0.4, width: 0.2, layer: "top" },
      { route_type: "wire", x: 2, y: -0.4, width: 0.2, layer: "top" },
    ],
  }
  const ownTrace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace_own",
    route: [
      { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
      { route_type: "wire", x: 0, y: 0.28, width: 0.2, layer: "top" },
    ],
  }

  const circuit: AnyCircuitElement[] = [
    { ...via, pcb_trace_id: "trace_own" },
    unrelatedTrace,
    safeTrace,
    ownTrace,
  ]

  expect(checkViaTraceClearance(circuit)).toHaveLength(0)
  const holeErrors = checkHoleTraceClearance(circuit)
  expect(holeErrors).toHaveLength(1)
  expect(holeErrors[0]).toMatchObject({
    type: "pcb_trace_error",
    pcb_trace_error_id: "overlap_trace_unrelated_via_1",
    pcb_trace_id: "trace_unrelated",
  })
  expect(holeErrors[0]?.message).toContain("via hole")
})
