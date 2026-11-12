import type { PcbPlatedHole, PcbSmtPad, PcbTrace } from "circuit-json"
import {
  getPadBounds,
  getTraceObstacleClearance,
} from "../check-pad-clearance/common"
import { isPointInPad } from "../check-traces-are-contiguous/is-point-in-pad"
import { getLayersOfPcbElement } from "./getLayersOfPcbElement"

export type PcbPad = PcbSmtPad | PcbPlatedHole
export type PcbTraceRoutePoint = PcbTrace["route"][number]

const ENDPOINT_COPPER_CONTACT_EPSILON_MM = 1e-9

/**
 * The round copper cap at a trace end can enter a pad while its center remains
 * outside. Requires actual overlap, using the adjacent segment's physical width.
 * The caller decides which pads count; this does not check layer or net.
 */
export function endpointCopperOverlapsPad({
  point,
  pad,
  endpointCopperWidth,
  bounds = getPadBounds(pad),
}: {
  point: { x: number; y: number }
  pad: PcbPad
  endpointCopperWidth: number
  bounds?: ReturnType<typeof getPadBounds>
}): boolean {
  if (!Number.isFinite(endpointCopperWidth) || endpointCopperWidth <= 0) {
    return false
  }
  const radius = endpointCopperWidth / 2
  if (
    point.x + radius <= bounds.minX ||
    point.x - radius >= bounds.maxX ||
    point.y + radius <= bounds.minY ||
    point.y - radius >= bounds.maxY
  ) {
    return false
  }
  const { gap } = getTraceObstacleClearance(
    {
      x1: point.x,
      y1: point.y,
      x2: point.x,
      y2: point.y,
      thickness: endpointCopperWidth,
    },
    pad,
  )
  return gap < -ENDPOINT_COPPER_CONTACT_EPSILON_MM
}

export function routePointTouchesPad(point: PcbTraceRoutePoint, pad: PcbPad) {
  return (
    point.route_type === "wire" &&
    getLayersOfPcbElement(pad).includes(point.layer) &&
    isPointInPad(point, pad)
  )
}
