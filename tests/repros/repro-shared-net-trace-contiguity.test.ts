import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

test.failing(
  "same-net routed branch should satisfy the required PCB port",
  () => {
    const circuitJson = [
      {
        type: "pcb_board",
        pcb_board_id: "pcb_board_0",
        center: { x: 5, y: 0 },
        width: 14,
        height: 6,
        thickness: 1.6,
        num_layers: 2,
        material: "fr4",
      },
      {
        type: "source_trace",
        source_trace_id: "source_trace_kelvin",
        connected_source_port_ids: [
          "source_port_shunt",
          "source_port_kelvin_link",
        ],
        connected_source_net_ids: [],
      },
      {
        type: "source_trace",
        source_trace_id: "source_trace_shunt_gnd",
        connected_source_port_ids: ["source_port_shunt"],
        connected_source_net_ids: ["source_net_gnd"],
      },
      {
        type: "source_trace",
        source_trace_id: "source_trace_bus_gnd",
        connected_source_port_ids: ["source_port_bus_gnd"],
        connected_source_net_ids: ["source_net_gnd"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "pcb_port_shunt",
        source_port_id: "source_port_shunt",
        x: 0,
        y: 0,
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "pcb_port_bus_gnd",
        source_port_id: "source_port_bus_gnd",
        x: 5,
        y: 0,
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "pcb_port_kelvin_link",
        source_port_id: "source_port_kelvin_link",
        x: 10,
        y: 0,
        layers: ["top"],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pcb_smtpad_shunt",
        pcb_port_id: "pcb_port_shunt",
        shape: "rect",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pcb_smtpad_bus_gnd",
        pcb_port_id: "pcb_port_bus_gnd",
        shape: "rect",
        x: 5,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pcb_smtpad_kelvin_link",
        pcb_port_id: "pcb_port_kelvin_link",
        shape: "rect",
        x: 10,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "pcb_trace_kelvin",
        source_trace_id: "source_trace_kelvin",
        route: [
          {
            route_type: "wire",
            x: 10,
            y: 0,
            layer: "top",
            width: 0.2,
            start_pcb_port_id: "pcb_port_kelvin_link",
          },
          {
            route_type: "wire",
            x: 5,
            y: 0,
            layer: "top",
            width: 0.2,
            end_pcb_port_id: "pcb_port_bus_gnd",
          },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "pcb_trace_bus_gnd_to_shunt",
        source_trace_id: "source_trace_bus_gnd",
        route: [
          {
            route_type: "wire",
            x: 5,
            y: 0,
            layer: "top",
            width: 0.2,
            start_pcb_port_id: "pcb_port_bus_gnd",
          },
          {
            route_type: "wire",
            x: 0,
            y: 0,
            layer: "top",
            width: 0.2,
            end_pcb_port_id: "pcb_port_shunt",
          },
        ],
      },
    ] as AnyCircuitElement[]

    const errors = checkTracesAreContiguous(circuitJson)

    expect(
      convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
        shouldDrawErrors: true,
      }),
    ).toMatchSvgSnapshot(import.meta.path)
    expect(errors).toHaveLength(0)
  },
)
