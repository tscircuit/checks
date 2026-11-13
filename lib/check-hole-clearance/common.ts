import { Point, Segment } from "@flatten-js/core"
import {
  type FlattenElement,
  convertCircuitJsonToFlattenJs,
} from "@tscircuit/circuit-json-to-flattenjs"
import {
  pointToSegmentClosestPoint,
  pointToSegmentDistance,
} from "@tscircuit/math-utils"
import type { AnyCircuitElement, PcbVia } from "circuit-json"
import type { PcbTraceSegment } from "../check-each-pcb-trace-non-overlapping/getCollidableBounds"
import { DEFAULT_VIA_DIAMETER } from "../drc-defaults"

export const getHoleGeometries = (
  circuitJson: AnyCircuitElement[],
): FlattenElement[] =>
  convertCircuitJsonToFlattenJs(
    circuitJson.filter((e) => e.type === "pcb_hole"),
    {
      elementTypes: ["pcb_hole"],
      strict: true,
      curveTolerance: 1e-6,
    },
  ).elements

/** Uses the same physical hole boundary for overlap and clearance checks. */
export const getTraceHoleClearance = (
  trace: Pick<PcbTraceSegment, "x1" | "y1" | "x2" | "y2" | "thickness">,
  geometry: FlattenElement,
): { gap: number; center: { x: number; y: number } } => {
  const hole = geometry.sourceElement
  if (hole.type !== "pcb_hole") {
    throw new Error("Expected hole geometry")
  }
  const a = new Point(trace.x1, trace.y1)
  const b = new Point(trace.x2, trace.y2)
  let distance = Number.POSITIVE_INFINITY
  let center = pointToSegmentClosestPoint(hole, a, b)
  if (hole.hole_shape === "circle") {
    distance = pointToSegmentDistance(hole, a, b) - hole.hole_diameter / 2
  } else {
    const segment = new Segment(a, b)
    for (const shape of geometry.shapes) {
      const [boundaryDistance, shortest] = shape.distanceTo(segment)
      const shapeDistance =
        shape.contains(a) || shape.contains(b) ? 0 : boundaryDistance
      if (shapeDistance < distance) {
        distance = shapeDistance
        center = shortest.end
      }
    }
  }
  return { gap: distance - trace.thickness / 2, center }
}

/** Uses the same physical hole boundary for via overlap and clearance checks. */
export const getViaHoleClearance = (
  via: Pick<PcbVia, "x" | "y"> & Partial<Pick<PcbVia, "outer_diameter">>,
  geometry: FlattenElement,
): { gap: number; center: { x: number; y: number } } => {
  const hole = geometry.sourceElement
  if (hole.type !== "pcb_hole") {
    throw new Error("Expected hole geometry")
  }
  const viaRadius = (via.outer_diameter ?? DEFAULT_VIA_DIAMETER ?? 0.3) / 2
  if (hole.hole_shape === "circle") {
    const centerDist = Math.hypot(via.x - hole.x, via.y - hole.y)
    const holeRadius = hole.hole_diameter / 2
    const gap = centerDist - holeRadius - viaRadius
    const center =
      centerDist > 1e-6
        ? {
            x: hole.x + ((via.x - hole.x) / centerDist) * holeRadius,
            y: hole.y + ((via.y - hole.y) / centerDist) * holeRadius,
          }
        : { x: via.x, y: via.y }
    return { gap, center }
  }

  const viaPoint = new Point(via.x, via.y)
  let boundaryDist = Number.POSITIVE_INFINITY
  let center: { x: number; y: number } = { x: via.x, y: via.y }
  let isInside = false

  for (const shape of geometry.shapes) {
    if (shape.contains(viaPoint)) {
      isInside = true
    }
    const [dist, shortest] = shape.distanceTo(viaPoint)
    if (dist < boundaryDist) {
      boundaryDist = dist
      if (shortest?.start) {
        center = { x: shortest.start.x, y: shortest.start.y }
      }
    }
  }

  const gap = isInside ? -boundaryDist - viaRadius : boundaryDist - viaRadius
  return { gap, center }
}
