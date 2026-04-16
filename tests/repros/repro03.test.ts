import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkSourceTracesMatchPcbTraceThickness } from "lib/check-source-traces-match-pcb-trace-thickness"

const repro03CircuitJson: AnyCircuitElement[] = [
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_0",
    center: { x: 0, y: 0 },
    width: 30,
    height: 20,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
  },
  {
    type: "source_trace",
    source_trace_id: "source_trace_0",
    connected_source_port_ids: ["source_port_1", "source_port_2"],
    connected_source_net_ids: [],
    display_name: "PWR -> TINY_CHIP.VDD",
    min_trace_thickness: 1,
  },
  {
    type: "source_component",
    source_component_id: "source_component_1",
    ftype: "simple_pin_header",
    name: "PWR",
  },
  {
    type: "source_component",
    source_component_id: "source_component_2",
    ftype: "simple_chip",
    name: "TINY_CHIP",
  },
  {
    type: "source_port",
    source_port_id: "source_port_1",
    source_component_id: "source_component_1",
    name: "pin1",
    pin_number: 1,
    port_hints: ["pin1"],
  },
  {
    type: "source_port",
    source_port_id: "source_port_2",
    source_component_id: "source_component_2",
    name: "VDD",
    pin_number: 1,
    port_hints: ["VDD"],
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_1",
    source_component_id: "source_component_1",
    center: { x: -10, y: 0 },
    width: 2.54,
    height: 2.54,
    layer: "top",
    rotation: 0,
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_2",
    source_component_id: "source_component_2",
    center: { x: 10, y: 0 },
    width: 3,
    height: 3,
    layer: "top",
    rotation: 0,
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_1",
    source_port_id: "source_port_1",
    pcb_component_id: "pcb_component_1",
    x: -10,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_2",
    source_port_id: "source_port_2",
    pcb_component_id: "pcb_component_2",
    x: 10,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_0",
    source_trace_id: "source_trace_0",
    route: [
      {
        route_type: "wire",
        x: -10,
        y: 0,
        width: 0.15,
        layer: "top",
        start_pcb_port_id: "pcb_port_1",
      },
      {
        route_type: "wire",
        x: 0,
        y: 0,
        width: 0.15,
        layer: "top",
      },
      {
        route_type: "wire",
        x: 10,
        y: 0,
        width: 0.15,
        layer: "top",
        end_pcb_port_id: "pcb_port_2",
      },
    ],
  },
]

test("repro03 should emit a pcb trace warning for an undersized routed trace", () => {
  const warnings = checkSourceTracesMatchPcbTraceThickness(repro03CircuitJson)

  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    type: "pcb_trace_warning",
    warning_type: "pcb_trace_warning",
    source_trace_id: "source_trace_0",
    pcb_trace_id: "pcb_trace_0",
    center: { x: -5, y: 0 },
  })

  expect(
    convertCircuitJsonToPcbSvg([...repro03CircuitJson, ...warnings], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
