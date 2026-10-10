import { any_circuit_element, type AnyCircuitElement } from "circuit-json"

const key = "isolated_two_pair_test"
const xs = [0, 2, 10, 12]
const raw: AnyCircuitElement[] = [
  {
    type: "source_net",
    source_net_id: "source_net_1",
    name: "V3V3",
    member_source_group_ids: [],
    subcircuit_connectivity_map_key: key,
  },
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_1",
    center: { x: 6, y: 0 },
    width: 16,
    height: 6,
    num_layers: 2,
    thickness: 1.6,
    material: "fr4",
  },
]

// Each pin declares its connection to one named net independently.
for (let i = 0; i < 4; i++) {
  raw.push(
    {
      type: "source_component",
      source_component_id: `source_component_${i}`,
      name: ["A", "B", "C", "D"][i],
      ftype: "simple_chip",
    },
    {
      type: "source_port",
      source_port_id: `source_port_${i}`,
      source_component_id: `source_component_${i}`,
      name: "VDD",
      port_hints: ["pin1", "VDD"],
      subcircuit_connectivity_map_key: key,
    },
    {
      type: "source_trace",
      source_trace_id: `source_trace_${i}`,
      connected_source_port_ids: [`source_port_${i}`],
      connected_source_net_ids: ["source_net_1"],
      subcircuit_connectivity_map_key: key,
    },
    {
      type: "pcb_component",
      pcb_component_id: `pcb_component_${i}`,
      source_component_id: `source_component_${i}`,
      center: { x: xs[i], y: 0 },
      width: 1,
      height: 1,
      layer: "top",
      rotation: 0,
      obstructs_within_bounds: true,
    },
    {
      type: "pcb_port",
      pcb_port_id: `pcb_port_${i}`,
      source_port_id: `source_port_${i}`,
      pcb_component_id: `pcb_component_${i}`,
      x: xs[i],
      y: 0,
      layers: ["top"],
      subcircuit_connectivity_map_key: key,
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: `pcb_smtpad_${i}`,
      pcb_port_id: `pcb_port_${i}`,
      pcb_component_id: `pcb_component_${i}`,
      shape: "rect",
      x: xs[i],
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
      subcircuit_connectivity_map_key: key,
    },
  )
}

// A-B and C-D have anchored endpoints but no copper joins the two islands.
for (const i of [0, 2]) {
  raw.push({
    type: "pcb_trace",
    pcb_trace_id: `pcb_trace_${i}`,
    source_trace_id: `source_trace_${i}`,
    subcircuit_connectivity_map_key: key,
    route: [
      {
        route_type: "wire",
        x: xs[i],
        y: 0,
        layer: "top",
        width: 0.2,
        start_pcb_port_id: `pcb_port_${i}`,
      },
      {
        route_type: "wire",
        x: xs[i + 1],
        y: 0,
        layer: "top",
        width: 0.2,
        end_pcb_port_id: `pcb_port_${i + 1}`,
      },
    ],
  })
}

export const disconnectedPcbNet = raw.map((element) =>
  any_circuit_element.parse(element),
)
