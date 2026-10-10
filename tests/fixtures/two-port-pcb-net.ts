import type { AnyCircuitElement } from "circuit-json"

export const twoPortPcbNet: AnyCircuitElement[] = [
  {
    type: "source_net",
    source_net_id: "source_net_vdd",
    name: "VDD",
    member_source_group_ids: [],
  },
  {
    type: "source_trace",
    source_trace_id: "source_trace_vdd",
    connected_source_port_ids: ["source_port_A", "source_port_B"],
    connected_source_net_ids: ["source_net_vdd"],
  },
]

// Two separated pads require a copper connection between their ports.
for (const { name, x } of [
  { name: "A", x: 0 },
  { name: "B", x: 4 },
]) {
  twoPortPcbNet.push(
    {
      type: "source_component",
      source_component_id: `source_component_${name}`,
      name,
      ftype: "simple_chip",
    },
    {
      type: "source_port",
      source_port_id: `source_port_${name}`,
      source_component_id: `source_component_${name}`,
      name: "VDD",
      port_hints: ["VDD"],
    },
    {
      type: "pcb_component",
      pcb_component_id: `pcb_component_${name}`,
      source_component_id: `source_component_${name}`,
      center: { x, y: 0 },
      width: 1,
      height: 1,
      layer: "top",
      rotation: 0,
      obstructs_within_bounds: true,
    },
    {
      type: "pcb_port",
      pcb_port_id: `pcb_port_${name}`,
      source_port_id: `source_port_${name}`,
      pcb_component_id: `pcb_component_${name}`,
      x,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: `pcb_smtpad_${name}`,
      pcb_port_id: `pcb_port_${name}`,
      pcb_component_id: `pcb_component_${name}`,
      shape: "rect",
      x,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
  )
}
