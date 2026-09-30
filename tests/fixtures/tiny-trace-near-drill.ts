import type { PcbTrace } from "circuit-json"

export const trace: PcbTrace = {
  type: "pcb_trace",
  pcb_trace_id: "tiny_segment_near_drill",
  route: [
    {
      route_type: "wire",
      x: -5.187482788357944,
      y: 0.8605189568595305,
      width: 0.15,
      layer: "bottom",
    },
    {
      route_type: "wire",
      x: -5.18748104314047,
      y: 0.8605189568595305,
      width: 0.15,
      layer: "bottom",
    },
    { route_type: "wire", x: -5.125, y: 0.923, width: 0.15, layer: "bottom" },
    {
      route_type: "via",
      x: -5.125,
      y: 0.923,
      from_layer: "bottom",
      to_layer: "top",
      outer_diameter: 0.45,
      hole_diameter: 0.2,
    },
  ],
}
