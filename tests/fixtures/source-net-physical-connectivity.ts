import type {
  AnyCircuitElement,
  LayerRef,
  PcbTraceRoutePointWire,
} from "circuit-json"

function createSourceNet({
  sourceNetId,
  name,
}: {
  sourceNetId: string
  name: string
}): AnyCircuitElement {
  return {
    type: "source_net",
    source_net_id: sourceNetId,
    name,
    member_source_group_ids: [],
  }
}

function createPortAndPad({
  id,
  sourcePortId = `source_port_${id}`,
  x,
  y = 0,
  layer = "top",
}: {
  id: string
  sourcePortId?: string
  x: number
  y?: number
  layer?: LayerRef
}): AnyCircuitElement[] {
  return [
    {
      type: "pcb_port",
      pcb_port_id: `pcb_port_${id}`,
      source_port_id: sourcePortId,
      x,
      y,
      layers: [layer],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: `pcb_smtpad_${id}`,
      pcb_port_id: `pcb_port_${id}`,
      shape: "rect",
      x,
      y,
      width: 1,
      height: 1,
      layer,
    },
  ]
}

function wirePoint({
  x,
  y = 0,
  width = 0.15,
  layer = "top",
  ...endpointIds
}: {
  x: number
  y?: number
  width?: number
  layer?: LayerRef
  start_pcb_port_id?: string
  end_pcb_port_id?: string
}): PcbTraceRoutePointWire {
  return {
    route_type: "wire",
    x,
    y,
    width,
    layer,
    ...endpointIds,
  }
}

export const splitSourceNetId = "source_net_split"

export function createSplitSourceNetCircuitJson(): AnyCircuitElement[] {
  const portXs = [-6, -3, 3, 6]
  return [
    {
      type: "pcb_board",
      pcb_board_id: "pcb_board_0",
      center: { x: 0, y: 0 },
      width: 30,
      height: 6,
      material: "fr4",
      thickness: 1.6,
      num_layers: 2,
    },
    createSourceNet({ sourceNetId: splitSourceNetId, name: "SPLIT_NET" }),
    ...portXs.flatMap((x, index): AnyCircuitElement[] => [
      {
        type: "source_trace",
        source_trace_id: `source_trace_port_${index}`,
        connected_source_port_ids: [`source_port_${index}`],
        connected_source_net_ids: [splitSourceNetId],
      },
      ...createPortAndPad({ id: index.toString(), x }),
    ]),
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_left_group",
      source_trace_id: splitSourceNetId,
      route: [
        wirePoint({ x: -6, width: 0.2, start_pcb_port_id: "pcb_port_0" }),
        wirePoint({ x: -3, width: 0.2, end_pcb_port_id: "pcb_port_1" }),
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_right_group",
      source_trace_id: splitSourceNetId,
      route: [
        wirePoint({ x: 3, width: 0.2, start_pcb_port_id: "pcb_port_2" }),
        wirePoint({ x: 6, width: 0.2, end_pcb_port_id: "pcb_port_3" }),
      ],
    },
  ]
}

export const breakoutParentNetId = "source_net_parent"

export function createBreakoutSourceNetCircuitJson(): AnyCircuitElement[] {
  const childNetId = "source_net_child"
  return [
    createSourceNet({ sourceNetId: breakoutParentNetId, name: "VCC" }),
    createSourceNet({ sourceNetId: childNetId, name: "VCC" }),
    {
      type: "source_trace",
      source_trace_id: "source_trace_child_to_parent",
      connected_source_port_ids: ["source_port_child"],
      connected_source_net_ids: [breakoutParentNetId],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_load",
      connected_source_port_ids: ["source_port_load"],
      connected_source_net_ids: [breakoutParentNetId],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_internal",
      connected_source_port_ids: ["source_port_child"],
      connected_source_net_ids: [childNetId],
    },
    ...createPortAndPad({
      id: "child",
      sourcePortId: "source_port_child",
      x: -3,
    }),
    ...createPortAndPad({
      id: "load",
      sourcePortId: "source_port_load",
      x: 3,
    }),
    {
      type: "pcb_breakout_point",
      pcb_breakout_point_id: "pcb_breakout_point_0",
      pcb_group_id: "pcb_group_child",
      source_port_id: "source_port_child",
      source_trace_id: "source_trace_internal",
      source_net_id: childNetId,
      x: 0,
      y: 0,
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_internal",
      source_trace_id: "source_trace_internal",
      route: [
        wirePoint({ x: -3, start_pcb_port_id: "pcb_port_child" }),
        wirePoint({ x: 0 }),
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_parent",
      source_trace_id: "source_trace_load",
      route: [
        wirePoint({ x: 3, start_pcb_port_id: "pcb_port_load" }),
        wirePoint({ x: 0.0001 }),
      ],
    },
  ]
}

export const padlessViaSourceNetId = "source_net_via"

export function createPadlessViaSourceNetCircuitJson(): AnyCircuitElement[] {
  return [
    createSourceNet({ sourceNetId: padlessViaSourceNetId, name: "GND" }),
    {
      type: "source_trace",
      source_trace_id: "source_trace_to_via",
      connected_source_port_ids: ["source_port_component", "source_port_via"],
      connected_source_net_ids: [padlessViaSourceNetId],
    },
    ...createPortAndPad({
      id: "component",
      sourcePortId: "source_port_component",
      x: -3,
    }),
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_via",
      source_port_id: "source_port_via",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_via",
      pcb_via_id: "pcb_via_0",
      source_net_id: padlessViaSourceNetId,
      x: 0,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      layers: ["top", "bottom"],
      from_layer: "top",
      to_layer: "bottom",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_to_via",
      source_trace_id: "source_trace_to_via",
      route: [
        wirePoint({ x: -3, start_pcb_port_id: "pcb_port_component" }),
        wirePoint({ x: 0, end_pcb_port_id: "pcb_port_via" }),
      ],
    },
  ]
}
