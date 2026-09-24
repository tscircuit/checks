import type { PcbPlatedHole, PcbSmtPad, PcbTrace } from "circuit-json"
import { isPointInPad } from "../check-traces-are-contiguous/is-point-in-pad"
import { getLayersOfPcbElement } from "./getLayersOfPcbElement"

export type PcbPad = PcbSmtPad | PcbPlatedHole
export type PcbTraceRoutePoint = PcbTrace["route"][number]

export function routePointTouchesPad(point: PcbTraceRoutePoint, pad: PcbPad) {
  return (
    point.route_type === "wire" &&
    getLayersOfPcbElement(pad).includes(point.layer) &&
    isPointInPad(point, pad)
  )
}
