import type { AnyCircuitElement } from "circuit-json"
import { checkCopperPourDeadEndFingers } from "../../index"

export const net = {
  type: "source_net",
  source_net_id: "source_net_1",
  name: "GND",
}
export const points = (coordinates: number[][]) =>
  coordinates.map(([x, y]) => ({ x, y }))
export const outline = (length = 5, width = 1) =>
  points([
    [0, 0],
    [5, 0],
    [5, 2],
    [5 + length, 2],
    [5 + length, 2 + width],
    [5, 2 + width],
    [5, 6],
    [0, 6],
  ])
export const pour = (vertices = outline()) => ({
  type: "pcb_copper_pour",
  pcb_copper_pour_id: "pcb_copper_pour_1",
  shape: "polygon",
  source_net_id: net.source_net_id,
  layer: "top",
  points: vertices,
})
export const via = (x = 9.5) => ({
  type: "pcb_via",
  pcb_via_id: "pcb_via_1",
  x,
  y: 2.5,
  outer_diameter: 0.6,
  hole_diameter: 0.3,
  layers: ["top", "bottom"],
  source_net_id: net.source_net_id,
})
export const circuit = (...elements: unknown[]) =>
  [net, ...elements] as AnyCircuitElement[]
export const check = (...elements: unknown[]) =>
  checkCopperPourDeadEndFingers(circuit(...elements))
