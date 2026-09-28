import type { AnyCircuitElement, PcbTrace } from "circuit-json"

export function traceWidthFixture(
  widths: number[],
  mode?: PcbTrace["route_thickness_mode"],
): AnyCircuitElement[] {
  return [
    {
      type: "source_trace",
      source_trace_id: "source_trace_0",
      connected_source_port_ids: ["source_port_0", "source_port_1"],
      connected_source_net_ids: [],
      min_trace_thickness: 1,
      display_name: "Power rail",
    },
    ...[0, 1].map((i) => ({
      type: "pcb_port" as const,
      pcb_port_id: `pcb_port_${i}`,
      source_port_id: `source_port_${i}`,
      pcb_component_id: `pcb_component_${i}`,
      x: i * (widths.length - 1) * 10,
      y: 0,
      layers: ["top" as const],
    })),
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_0",
      source_trace_id: "source_trace_0",
      route_thickness_mode: mode,
      route: widths.map((width, i) => ({
        route_type: "wire" as const,
        x: i * 10,
        y: 0,
        width,
        layer: "top" as const,
        ...(i === 0 ? { start_pcb_port_id: "pcb_port_0" } : {}),
        ...(i === widths.length - 1 ? { end_pcb_port_id: "pcb_port_1" } : {}),
      })),
    },
  ]
}
