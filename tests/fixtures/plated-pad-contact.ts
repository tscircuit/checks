import type { AnyCircuitElement, LayerRef } from "circuit-json"

export function platedPadContactFixture(
  end = { x: 0, y: 0.019627030476826 },
  layer: LayerRef = "top",
): AnyCircuitElement[] {
  return [
    {
      type: "source_component",
      source_component_id: "sc_cap",
      name: "C_USB_BULK",
      ftype: "simple_capacitor",
      capacitance: 0.0001,
    },
    {
      type: "source_port",
      source_port_id: "sp_cap",
      source_component_id: "sc_cap",
      name: "pin1",
      pin_number: 1,
    },
    {
      type: "source_net",
      source_net_id: "sn_vbus",
      name: "USB_VBUS",
      member_source_group_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "st_cap",
      connected_source_port_ids: ["sp_cap"],
      connected_source_net_ids: ["sn_vbus"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pp_cap",
      source_port_id: "sp_cap",
      pcb_component_id: "pc_cap",
      x: 0,
      y: 0,
      layers: ["top", "inner1", "inner2", "bottom"],
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "ph_cap",
      pcb_port_id: "pp_cap",
      x: 0,
      y: 0,
      shape: "circle",
      outer_diameter: 1.6,
      hole_diameter: 1,
      layers: ["top", "inner1", "inner2", "bottom"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pt_feed",
      source_trace_id: "st_cap",
      route: [
        { route_type: "wire", x: 2, y: end.y, width: 0.15, layer },
        { route_type: "wire", ...end, width: 0.15, layer },
      ],
    },
  ]
}
