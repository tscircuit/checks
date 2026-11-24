import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { addStartAndEndPortIdsIfMissing } from "lib/add-start-and-end-port-ids-if-missing"
import { checkEachPcbPortConnectedToPcbTraces } from "lib/check-each-pcb-port-connected-to-pcb-trace"
import { runAllRoutingChecks } from "lib/run-all-checks"

test("infers start and end port IDs for rotated_rect and polygon SMT pads", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board_1",
      center: { x: 2.5, y: 0 },
      width: 12,
      height: 8,
      num_layers: 2,
      thickness: 1.6,
      material: "fr4",
    },
    {
      type: "source_component",
      source_component_id: "src_u1",
      ftype: "simple_resistor",
      name: "R1",
      resistance: 1000,
    },
    {
      type: "source_component",
      source_component_id: "src_u2",
      ftype: "simple_resistor",
      name: "R2",
      resistance: 1000,
    },
    {
      type: "source_port",
      source_port_id: "src_port_1",
      source_component_id: "src_u1",
      name: "pin1",
    },
    {
      type: "source_port",
      source_port_id: "src_port_2",
      source_component_id: "src_u2",
      name: "pin1",
    },
    {
      type: "source_trace",
      source_trace_id: "src_trace_1",
      connected_source_port_ids: ["src_port_1", "src_port_2"],
      connected_source_net_ids: [],
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_u1",
      source_component_id: "src_u1",
      center: { x: 0, y: 0 },
      layer: "top",
      rotation: 45,
      width: 2,
      height: 1,
      obstructs_within_bounds: true,
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_u2",
      source_component_id: "src_u2",
      center: { x: 5, y: 0 },
      layer: "top",
      rotation: 0,
      width: 2,
      height: 2,
      obstructs_within_bounds: true,
    },
    {
      type: "pcb_port",
      pcb_port_id: "port_rot_rect",
      source_port_id: "src_port_1",
      pcb_component_id: "pcb_u1",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "port_polygon",
      source_port_id: "src_port_2",
      pcb_component_id: "pcb_u2",
      x: 5,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_rot_rect",
      pcb_component_id: "pcb_u1",
      pcb_port_id: "port_rot_rect",
      shape: "rotated_rect",
      x: 0,
      y: 0,
      width: 2,
      height: 0.8,
      ccw_rotation: 45,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_polygon",
      pcb_component_id: "pcb_u2",
      pcb_port_id: "port_polygon",
      shape: "polygon",
      layer: "top",
      points: [
        { x: 4.2, y: -0.5 },
        { x: 5.8, y: -0.5 },
        { x: 5.8, y: 0.5 },
        { x: 4.2, y: 0.5 },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_1",
      source_trace_id: "src_trace_1",
      route: [
        { route_type: "wire", x: 0.5, y: 0.5, width: 0.15, layer: "top" },
        { route_type: "wire", x: 2.5, y: 0.5, width: 0.15, layer: "top" },
        { route_type: "wire", x: 4.4, y: 0.2, width: 0.15, layer: "top" },
      ],
    },
  ]

  expect(await runAllRoutingChecks(circuitJson)).toEqual([])

  const trace = circuitJson.find((e) => e.type === "pcb_trace") as PcbTrace
  expect(trace.route[0]).toHaveProperty("start_pcb_port_id", "port_rot_rect")
  expect(trace.route[2]).toHaveProperty("end_pcb_port_id", "port_polygon")
})

test("infers start and end port IDs for plated holes across circle, rotated pill, rect-pad, and polygon-pad shapes", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_port",
      pcb_port_id: "port_circle_hole",
      source_port_id: "sp_1",
      pcb_component_id: "comp_1",
      x: 0,
      y: 0,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "ph_circle",
      pcb_component_id: "comp_1",
      pcb_port_id: "port_circle_hole",
      shape: "circle",
      x: 0,
      y: 0,
      outer_diameter: 1.6,
      hole_diameter: 0.8,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "port_rot_pill_hole",
      source_port_id: "sp_2",
      pcb_component_id: "comp_1",
      x: 5,
      y: 0,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "ph_rot_pill",
      pcb_component_id: "comp_1",
      pcb_port_id: "port_rot_pill_hole",
      shape: "pill",
      x: 5,
      y: 0,
      outer_width: 2.4,
      outer_height: 1.0,
      hole_width: 1.4,
      hole_height: 0.5,
      ccw_rotation: 45,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "port_rect_pad_hole",
      source_port_id: "sp_3",
      pcb_component_id: "comp_2",
      x: 0,
      y: 5,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "ph_rect_pad",
      pcb_component_id: "comp_2",
      pcb_port_id: "port_rect_pad_hole",
      shape: "circular_hole_with_rect_pad",
      hole_shape: "circle",
      pad_shape: "rect",
      x: 0,
      y: 5,
      hole_diameter: 0.8,
      rect_pad_width: 2.0,
      rect_pad_height: 1.4,
      hole_offset_x: 0,
      hole_offset_y: 0,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "port_poly_pad_hole",
      source_port_id: "sp_4",
      pcb_component_id: "comp_2",
      x: 5,
      y: 5,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "ph_poly_pad",
      pcb_component_id: "comp_2",
      pcb_port_id: "port_poly_pad_hole",
      shape: "hole_with_polygon_pad",
      hole_shape: "circle",
      hole_diameter: 0.8,
      hole_offset_x: 0,
      hole_offset_y: 0,
      x: 5,
      y: 5,
      layers: ["top", "bottom"],
      pad_outline: [
        { x: -1.2, y: -0.6 },
        { x: 1.2, y: -0.6 },
        { x: 1.2, y: 0.6 },
        { x: -1.2, y: 0.6 },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_a",
      route: [
        { route_type: "wire", x: 0.6, y: 0, width: 0.2, layer: "bottom" },
        { route_type: "wire", x: 5.5, y: 0.5, width: 0.2, layer: "bottom" },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_b",
      route: [
        { route_type: "wire", x: 0.8, y: 5.4, width: 0.2, layer: "top" },
        { route_type: "wire", x: 4.0, y: 5.2, width: 0.2, layer: "top" },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_unplated_inner_layer",
      route: [
        { route_type: "wire", x: 0.6, y: 0, width: 0.2, layer: "inner1" },
        { route_type: "wire", x: 2.0, y: 0, width: 0.2, layer: "inner1" },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_inside_drilled_void",
      route: [
        { route_type: "wire", x: 0.2, y: 0, width: 0.1, layer: "top" },
        { route_type: "wire", x: 0.3, y: 0, width: 0.1, layer: "top" },
      ],
    },
  ]

  addStartAndEndPortIdsIfMissing(circuitJson)

  const traceA = circuitJson.find(
    (e) => e.type === "pcb_trace" && e.pcb_trace_id === "trace_a",
  ) as PcbTrace
  const traceB = circuitJson.find(
    (e) => e.type === "pcb_trace" && e.pcb_trace_id === "trace_b",
  ) as PcbTrace
  const traceInner = circuitJson.find(
    (e) =>
      e.type === "pcb_trace" && e.pcb_trace_id === "trace_unplated_inner_layer",
  ) as PcbTrace
  const traceVoid = circuitJson.find(
    (e) =>
      e.type === "pcb_trace" && e.pcb_trace_id === "trace_inside_drilled_void",
  ) as PcbTrace

  expect(traceA.route[0]).toHaveProperty(
    "start_pcb_port_id",
    "port_circle_hole",
  )
  expect(traceA.route[1]).toHaveProperty(
    "end_pcb_port_id",
    "port_rot_pill_hole",
  )
  expect(traceB.route[0]).toHaveProperty(
    "start_pcb_port_id",
    "port_rect_pad_hole",
  )
  expect(traceB.route[1]).toHaveProperty(
    "end_pcb_port_id",
    "port_poly_pad_hole",
  )
  expect(traceInner.route[0]).not.toHaveProperty("start_pcb_port_id")
  expect(traceVoid.route[0]).not.toHaveProperty("start_pcb_port_id")
  expect(traceVoid.route[1]).not.toHaveProperty("end_pcb_port_id")
  expect(checkEachPcbPortConnectedToPcbTraces(circuitJson)).toEqual([])
})
