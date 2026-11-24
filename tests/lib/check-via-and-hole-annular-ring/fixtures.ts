import type { AnyCircuitElement, PcbBoard } from "circuit-json"

export const makeBoard = (drc: Partial<PcbBoard> = {}): PcbBoard => ({
  type: "pcb_board",
  pcb_board_id: "pcb_board_1",
  center: { x: 0, y: 0 },
  width: 20,
  height: 20,
  thickness: 1.6,
  num_layers: 2,
  material: "fr4",
  ...drc,
})

export const makeVia = (
  holeDiameter: number,
  outerDiameter: number,
  x = 0,
  y = 0,
): AnyCircuitElement => ({
  type: "pcb_via",
  pcb_via_id: "via_1",
  x,
  y,
  hole_diameter: holeDiameter,
  outer_diameter: outerDiameter,
  layers: ["top", "bottom"],
})

const viaRoutePoint = {
  route_type: "via" as const,
  x: 1,
  y: 1,
  from_layer: "top" as const,
  to_layer: "bottom" as const,
  hole_diameter: 0.3,
  outer_diameter: 0.35,
}

export const conciseTrace = (
  pcbTraceId: string,
  sourceTrace?: AnyCircuitElement,
): AnyCircuitElement[] => [
  ...(sourceTrace ? [sourceTrace] : []),
  {
    type: "pcb_trace",
    pcb_trace_id: pcbTraceId,
    ...(sourceTrace ? { source_trace_id: "source_trace_1" } : {}),
    route: [
      { route_type: "wire", x: 0, y: 0, layer: "top", width: 0.2 },
      viaRoutePoint,
      { route_type: "wire", x: 2, y: 2, layer: "bottom", width: 0.2 },
    ],
  },
]
