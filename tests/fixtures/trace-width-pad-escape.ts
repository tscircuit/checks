import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { traceWidthFixture } from "./trace-width"

export function padEscapeFixture(
  points: Array<[number, number, number]>,
  mode?: PcbTrace["route_thickness_mode"],
): AnyCircuitElement[] {
  const circuit = traceWidthFixture(
    points.map((point) => point[2]),
    mode,
  )
  const trace = circuit.find((element) => element.type === "pcb_trace")!
  trace.route.forEach((point, i) => {
    if (point.route_type !== "wire") return
    point.x = points[i][0]
    point.y = points[i][1]
  })
  for (const [i, point] of [points[0], points.at(-1)!].entries()) {
    const port = circuit.find(
      (element) =>
        element.type === "pcb_port" && element.pcb_port_id === `pcb_port_${i}`,
    )!
    if (port.type !== "pcb_port") continue
    port.x = point[0]
    port.y = point[1]
    circuit.push({
      type: "pcb_smtpad",
      pcb_smtpad_id: `pcb_smtpad_${i}`,
      pcb_component_id: `pcb_component_${i}`,
      pcb_port_id: port.pcb_port_id,
      shape: "rect",
      x: point[0],
      y: point[1],
      width: 0.5,
      height: 1.5,
      layer: "top",
    })
  }
  return circuit
}

export const shortPadTaper = () =>
  padEscapeFixture(
    [
      [0, 0, 0.3],
      [1.25, 0, 1],
      [18.75, 0, 1],
      [20, 0, 0.3],
    ],
    "interpolated",
  )
export const longPadEscape = () =>
  padEscapeFixture([
    [0, 0, 0.3],
    [4, 0, 1],
    [16, 0, 0.3],
    [20, 0, 0.3],
  ])
export const middleBottleneck = () =>
  padEscapeFixture([
    [0, 0, 0.3],
    [1.25, 0, 1],
    [8, 0, 0.3],
    [12, 0, 1],
    [18.75, 0, 0.3],
    [20, 0, 0.3],
  ])
