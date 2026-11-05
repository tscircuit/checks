import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkEachPcbPortConnectedToPcbTraces } from "lib/check-each-pcb-port-connected-to-pcb-trace"
import { checkPcbCopperOverKeepout } from "lib/check-pcb-copper-over-keepout"
import { checkPcbTraceSelfShorts } from "lib/check-pcb-trace-self-shorts"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

describe("multi-board keepout and per-board layer stack checks", () => {
  test("checkPcbCopperOverKeepout scopes keepouts to their owning board and component", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_board",
        pcb_board_id: "board_1",
        subcircuit_id: "sub_1",
        center: { x: 0, y: 0 },
        width: 10,
        height: 10,
        thickness: 1.6,
        num_layers: 2,
        material: "fr4",
      },
      {
        type: "pcb_board",
        pcb_board_id: "board_2",
        subcircuit_id: "sub_2",
        center: { x: 0, y: 0 },
        width: 10,
        height: 10,
        thickness: 1.6,
        num_layers: 2,
        material: "fr4",
      },
      {
        type: "pcb_keepout",
        pcb_keepout_id: "keepout_board_1",
        subcircuit_id: "sub_1",
        pcb_component_id: "comp_owner_1",
        shape: "rect",
        center: { x: 0, y: 0 },
        width: 4,
        height: 4,
        layers: ["top"],
      } as AnyCircuitElement,
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_owner_board_1",
        pcb_component_id: "comp_owner_1",
        subcircuit_id: "sub_1",
        shape: "rect",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_other_board_2",
        pcb_component_id: "comp_board_2",
        subcircuit_id: "sub_2",
        shape: "rect",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
      {
        type: "pcb_via",
        pcb_via_id: "via_other_board_2",
        subcircuit_id: "sub_2",
        x: 0,
        y: 0,
        outer_diameter: 0.6,
        hole_diameter: 0.3,
        layers: ["top", "bottom"],
      },
      {
        type: "pcb_via",
        pcb_via_id: "via_same_board_1",
        subcircuit_id: "sub_1",
        x: 0.5,
        y: 0.5,
        outer_diameter: 0.6,
        hole_diameter: 0.3,
        layers: ["top", "bottom"],
      },
    ]

    const errors = checkPcbCopperOverKeepout(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      type: "pcb_placement_error",
      pcb_placement_error_id:
        "copper_over_keepout_via_same_board_1_keepout_board_1",
    })
  })

  test("checkTracesAreContiguous and checkEachPcbPortConnectedToPcbTraces use each trace's owning board layer stack", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_board",
        pcb_board_id: "board_2layer",
        subcircuit_id: "sub_2layer",
        center: { x: 0, y: 0 },
        width: 20,
        height: 20,
        thickness: 1.6,
        num_layers: 2,
        material: "fr4",
      },
      {
        type: "pcb_board",
        pcb_board_id: "board_4layer",
        subcircuit_id: "sub_4layer",
        center: { x: 0, y: 0 },
        width: 20,
        height: 20,
        thickness: 1.6,
        num_layers: 4,
        material: "fr4",
      },
      // Emitted single-layer via on board_2layer at (2, 0) must not shadow board_4layer's route via
      {
        type: "pcb_via",
        pcb_via_id: "via_board_2layer",
        subcircuit_id: "sub_2layer",
        x: 2,
        y: 0,
        outer_diameter: 0.6,
        hole_diameter: 0.3,
        layers: ["top"],
      },
      {
        type: "source_trace",
        source_trace_id: "st_4layer",
        subcircuit_id: "sub_4layer",
        connected_source_port_ids: ["sp_1", "sp_2"],
        connected_source_net_ids: [],
      },
      {
        type: "pcb_port",
        pcb_port_id: "pp_1",
        source_port_id: "sp_1",
        subcircuit_id: "sub_4layer",
        x: 0,
        y: 0,
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "pp_2",
        source_port_id: "sp_2",
        subcircuit_id: "sub_4layer",
        x: 4,
        y: 0,
        layers: ["bottom"],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_1",
        pcb_port_id: "pp_1",
        subcircuit_id: "sub_4layer",
        shape: "rect",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_2",
        pcb_port_id: "pp_2",
        subcircuit_id: "sub_4layer",
        shape: "rect",
        x: 4,
        y: 0,
        width: 1,
        height: 1,
        layer: "bottom",
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_4layer",
        source_trace_id: "st_4layer",
        subcircuit_id: "sub_4layer",
        route: [
          {
            route_type: "wire",
            x: 0,
            y: 0,
            width: 0.2,
            layer: "top",
            start_pcb_port_id: "pp_1",
          },
          {
            route_type: "wire",
            x: 2,
            y: 0,
            width: 0.2,
            layer: "top",
          },
          {
            route_type: "via",
            x: 2,
            y: 0,
            from_layer: "top",
            to_layer: "inner1",
          },
          {
            route_type: "wire",
            x: 2,
            y: 0,
            width: 0.2,
            layer: "inner1",
          },
          {
            route_type: "wire",
            x: 4,
            y: 0,
            width: 0.2,
            layer: "inner1",
            end_pcb_port_id: "pp_2",
          },
          {
            route_type: "via",
            x: 4,
            y: 0,
            from_layer: "top",
            to_layer: "bottom",
            outer_diameter: 0.6,
          },
          {
            route_type: "wire",
            x: 4,
            y: 0,
            width: 0.2,
            layer: "bottom",
            end_pcb_port_id: "pp_2",
          },
        ],
      },
    ]

    expect(checkTracesAreContiguous(circuitJson)).toEqual([])
    expect(checkEachPcbPortConnectedToPcbTraces(circuitJson)).toEqual([])
  })

  test("checkPcbTraceSelfShorts uses the owning board layer stack and checks length_match_source_trace_ids", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_board",
        pcb_board_id: "board_1layer",
        subcircuit_id: "sub_1layer",
        center: { x: 0, y: 0 },
        width: 20,
        height: 20,
        thickness: 1.6,
        num_layers: 1,
        material: "fr4",
      },
      {
        type: "pcb_board",
        pcb_board_id: "board_4layer",
        subcircuit_id: "sub_4layer",
        center: { x: 0, y: 0 },
        width: 20,
        height: 20,
        thickness: 1.6,
        num_layers: 4,
        material: "fr4",
      },
      {
        type: "source_bus",
        source_bus_id: "bus_1",
        source_trace_ids: [],
        length_match_source_trace_ids: ["st_matched"],
        max_length_skew: 0.1,
      },
      {
        type: "source_trace",
        source_trace_id: "st_matched",
        subcircuit_id: "sub_4layer",
        connected_source_port_ids: [],
        connected_source_net_ids: [],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_matched",
        source_trace_id: "st_matched",
        subcircuit_id: "sub_4layer",
        route: [
          { route_type: "wire", x: -4, y: 0, width: 0.2, layer: "inner1" },
          { route_type: "wire", x: 4, y: 0, width: 0.2, layer: "inner1" },
          { route_type: "wire", x: 4, y: 3, width: 0.2, layer: "inner1" },
          { route_type: "wire", x: 0, y: 3, width: 0.2, layer: "inner1" },
          { route_type: "wire", x: 0, y: 0.4, width: 0.2, layer: "inner1" },
          {
            route_type: "via",
            x: 0,
            y: 0.4,
            from_layer: "top",
            to_layer: "bottom",
            outer_diameter: 0.7,
          },
          { route_type: "wire", x: 0, y: 0.4, width: 0.2, layer: "bottom" },
          { route_type: "wire", x: -2, y: 0.4, width: 0.2, layer: "bottom" },
        ],
      },
    ]

    const errors = checkPcbTraceSelfShorts(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      pcb_trace_id: "trace_matched",
      source_trace_id: "st_matched",
      center: { x: 0, y: 0.2 },
    })
  })
})
