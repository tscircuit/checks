import type { AnyCircuitElement, PcbTrace } from "circuit-json"

/** Board-world points in mm: +X right, +Y up, +Z above, right-handed. */
export function wire(x: number, y: number): PcbTrace["route"][number] {
  return { route_type: "wire", x, y, layer: "top", width: 0.15 }
}

/** Small board-world XY examples in mm; pad centers and routes are points. */
export function traceEndpointExample({
  title,
  explanation,
  padCenters,
  routes,
}: {
  title: string
  explanation: string
  padCenters: { x: number; y: number }[]
  routes: PcbTrace["route"][]
}): AnyCircuitElement[] {
  return [
    {
      type: "pcb_board",
      pcb_board_id: "board",
      center: { x: 0, y: 0.5 },
      width: 8,
      height: 5,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
    },
    {
      type: "source_trace",
      source_trace_id: "signal",
      connected_source_port_ids: padCenters.map((_, i) => `source_port_${i}`),
      connected_source_net_ids: [],
    },
    ...padCenters.flatMap((center, i): AnyCircuitElement[] => [
      {
        type: "pcb_port",
        pcb_port_id: `port_${i}`,
        source_port_id: `source_port_${i}`,
        ...center,
        layers: ["top"],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: `pad_${i}`,
        pcb_port_id: `port_${i}`,
        ...center,
        shape: "rect",
        width: 0.4,
        height: 0.4,
        layer: "top",
      },
    ]),
    ...routes.map(
      (route, i): PcbTrace => ({
        type: "pcb_trace",
        pcb_trace_id: `trace_${i}`,
        source_trace_id: "signal",
        route,
      }),
    ),
    {
      type: "pcb_note_text",
      pcb_note_text_id: "title",
      text: title,
      anchor_position: { x: 0, y: 2.45 },
      anchor_alignment: "center",
      layer: "top",
      font: "tscircuit2024",
      font_size: 0.24,
      color: "white",
    },
    {
      type: "pcb_note_text",
      pcb_note_text_id: "explanation",
      text: explanation,
      anchor_position: { x: 0, y: -1.3 },
      anchor_alignment: "center",
      layer: "top",
      font: "tscircuit2024",
      font_size: 0.21,
      color: "#5994dc",
    },
  ]
}
