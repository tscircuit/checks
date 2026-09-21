import type { AnyCircuitElement } from "circuit-json"
// Two top-layer pads joined through inner2 using plated through vias.
// The via routes name top/bottom, while pcb_via.layers includes inner2.
const wire = (x: number, layer = "top") => ({
  route_type: "wire",
  x,
  y: 0,
  width: 0.1,
  layer,
})
export const fixture = [
  {
    type: "pcb_board",
    pcb_board_id: "board",
    center: { x: 2, y: 0 },
    width: 10,
    height: 10,
    num_layers: 4,
    thickness: 1.2,
    material: "fr4",
  },
  {
    type: "source_component",
    source_component_id: "component",
    name: "U1",
    ftype: "simple_chip",
  },
  { type: "source_net", source_net_id: "net", name: "SIGNAL" },
  {
    type: "source_trace",
    source_trace_id: "source_trace",
    connected_source_port_ids: ["source_left", "source_right"],
    connected_source_net_ids: ["net"],
  },
  ...[
    ["left", 0],
    ["right", 4],
  ].flatMap(([id, x]) => [
    {
      type: "source_port",
      source_port_id: `source_${id}`,
      source_component_id: "component",
      name: id,
      port_hints: [id],
    },
    {
      type: "pcb_port",
      pcb_port_id: `port_${id}`,
      source_port_id: `source_${id}`,
      pcb_component_id: "pcb_component",
      x,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: `pad_${id}`,
      pcb_port_id: `port_${id}`,
      pcb_component_id: "pcb_component",
      shape: "circle",
      radius: 0.15,
      x,
      y: 0,
      layer: "top",
    },
  ]),
  ...[
    ["left", [wire(0), wire(1)]],
    ["middle", [wire(1, "inner2"), wire(3, "inner2")]],
    ["right", [wire(3), wire(4)]],
  ].map(([id, route]) => ({
    type: "pcb_trace",
    pcb_trace_id: `trace_${id}`,
    source_trace_id: "source_trace",
    route,
  })),
  ...[1, 3].flatMap((x) => [
    {
      type: "pcb_trace",
      pcb_trace_id: `via_trace_${x}`,
      source_trace_id: "source_trace",
      route: [
        wire(x),
        {
          route_type: "via",
          x,
          y: 0,
          from_layer: "top",
          to_layer: "bottom",
          via_diameter: 0.3,
          via_hole_diameter: 0.15,
        },
        wire(x, "bottom"),
      ],
    },
    {
      type: "pcb_via",
      pcb_via_id: `via_${x}`,
      pcb_trace_id: `via_trace_${x}`,
      x,
      y: 0,
      outer_diameter: 0.3,
      hole_diameter: 0.15,
      layers: ["top", "inner1", "inner2", "bottom"],
    },
  ]),
] as AnyCircuitElement[]
