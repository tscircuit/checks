import type { AnyCircuitElement } from "circuit-json"

function createPortAndPad({
  id,
  x,
}: {
  id: string
  x: number
}): AnyCircuitElement[] {
  return [
    {
      type: "pcb_port",
      pcb_port_id: `pcb_port_${id}`,
      source_port_id: `source_port_${id}`,
      x,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: `pcb_smtpad_${id}`,
      pcb_port_id: `pcb_port_${id}`,
      shape: "rect",
      x,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
  ]
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
    {
      type: "source_net",
      source_net_id: splitSourceNetId,
      name: "SPLIT_NET",
      member_source_group_ids: [],
    },
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
        {
          route_type: "wire",
          x: -6,
          y: 0,
          width: 0.2,
          layer: "top",
          start_pcb_port_id: "pcb_port_0",
        },
        {
          route_type: "wire",
          x: -3,
          y: 0,
          width: 0.2,
          layer: "top",
          end_pcb_port_id: "pcb_port_1",
        },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_right_group",
      source_trace_id: splitSourceNetId,
      route: [
        {
          route_type: "wire",
          x: 3,
          y: 0,
          width: 0.2,
          layer: "top",
          start_pcb_port_id: "pcb_port_2",
        },
        {
          route_type: "wire",
          x: 6,
          y: 0,
          width: 0.2,
          layer: "top",
          end_pcb_port_id: "pcb_port_3",
        },
      ],
    },
  ]
}
