import type {
  AnyCircuitElement,
  PcbBend,
  PcbBoard,
  PcbSmtPad,
  PcbStiffener,
  PcbTrace,
  PcbVia,
} from "circuit-json"
import { checkPcbBendZonePlacement, checkPcbBendZoneTraces } from "../../index"

export const board: PcbBoard = {
  type: "pcb_board",
  pcb_board_id: "board",
  center: { x: 0, y: 0 },
  width: 40,
  height: 20,
  thickness: 0.12,
  num_layers: 2,
  material: "flex",
}
export const bend: PcbBend = {
  type: "pcb_bend",
  pcb_bend_id: "bend",
  pcb_board_id: "board",
  start: { x: 0, y: -10 },
  end: { x: 0, y: 10 },
  bend_radius: 1,
  bend_angle: 90,
  bend_side: "left",
}
export const via = (id: string, x: number, y: number): PcbVia => ({
  type: "pcb_via",
  pcb_via_id: id,
  x,
  y,
  hole_diameter: 0.2,
  outer_diameter: 0.5,
  layers: ["top", "bottom"],
})
export const pad = (
  id: string,
  x: number,
  y: number,
): Extract<PcbSmtPad, { shape: "rect" }> => ({
  type: "pcb_smtpad",
  pcb_smtpad_id: id,
  x,
  y,
  shape: "rect",
  width: 0.5,
  height: 0.5,
  layer: "top",
})
export const stiffener: Extract<PcbStiffener, { shape: "rect" }> = {
  type: "pcb_stiffener",
  pcb_stiffener_id: "stiffener",
  pcb_board_id: "board",
  shape: "rect",
  center: { x: 0, y: -7 },
  width: 2,
  height: 2,
  layer: "bottom",
  material: "polyimide",
  thickness: 0.2,
}
export const trace = (
  id: string,
  points: [number, number][],
  width = 0.1,
): PcbTrace => ({
  type: "pcb_trace",
  pcb_trace_id: id,
  route: points.map(([x, y]) => ({
    route_type: "wire",
    x,
    y,
    width,
    layer: "top",
  })),
})
export const placementIds = (circuit: AnyCircuitElement[]) =>
  checkPcbBendZonePlacement(circuit).map(
    (error) => error.pcb_placement_error_id,
  )
export const traceIds = (circuit: AnyCircuitElement[]) =>
  checkPcbBendZoneTraces(circuit).map((error) => error.pcb_trace_id)
