import type {
  AnyCircuitElement,
  LayerRef,
  PcbClearanceRule,
} from "circuit-json"

export const earthRules: PcbClearanceRule[] = [
  {
    name: "EARTH outer",
    enabled: true,
    priority: 1,
    clearance: 4.14,
    scope1: {
      type: "and",
      scopes: [
        { type: "net", net_ids: ["source_net_earth"] },
        { type: "layer", layers: ["top", "bottom"] },
      ],
    },
    scope2: { type: "all" },
  },
  {
    name: "EARTH inner",
    enabled: true,
    priority: 2,
    clearance: 1.6,
    scope1: { type: "net", net_ids: ["source_net_earth"] },
    scope2: { type: "all" },
  },
  {
    name: "Global",
    enabled: true,
    priority: 10,
    clearance: 0.1397,
    scope1: { type: "all" },
    scope2: { type: "all" },
  },
]

export function clearanceFixture(layer: LayerRef = "top"): AnyCircuitElement[] {
  return [
    {
      type: "pcb_board",
      pcb_board_id: "pcb_board_1",
      center: { x: 5, y: 5 },
      width: 30,
      height: 30,
      thickness: 1.6,
      num_layers: 4,
      material: "fr4",
      clearance_rules: structuredClone(earthRules),
    },
    ...["earth", "signal"].flatMap((name, i): AnyCircuitElement[] => [
      {
        type: "source_net",
        source_net_id: `source_net_${name}`,
        name: name.toUpperCase(),
        member_source_group_ids: [],
      },
      {
        type: "source_trace",
        source_trace_id: `source_trace_${name}`,
        connected_source_port_ids: [],
        connected_source_net_ids: [`source_net_${name}`],
        name,
      },
      {
        type: "pcb_trace",
        pcb_trace_id: `pcb_trace_${name}`,
        source_trace_id: `source_trace_${name}`,
        route: [
          { route_type: "wire", x: 0, y: i * 2.2, width: 0.2, layer },
          { route_type: "wire", x: 10, y: i * 2.2, width: 0.2, layer },
        ],
      },
    ]),
  ]
}
