import {
  convertCircuitJsonToFlattenJs,
  type FlattenElement,
} from "@tscircuit/circuit-json-to-flattenjs"
import { Point, Segment } from "@flatten-js/core"
import {
  pointToSegmentClosestPoint,
  pointToSegmentDistance,
} from "@tscircuit/math-utils"
import type { AnyCircuitElement, PcbHole } from "circuit-json"
import type { PcbTraceSegment } from "../check-each-pcb-trace-non-overlapping/getCollidableBounds"

export const getHoleGeometries = (
  circuitJson: AnyCircuitElement[],
  { includeVias = false }: { includeVias?: boolean } = {},
): FlattenElement[] => {
  const nonPlatedHoles = circuitJson.filter((e) => e.type === "pcb_hole")
  // Convert the drill as a circle, not the via's outer copper envelope. Keep
  // the original via as the source for connectivity and diagnostics. Other
  // callers continue to receive only non-plated holes unless requested.
  const vias = includeVias
    ? circuitJson.filter((e) => e.type === "pcb_via")
    : []
  const options = {
    elementTypes: ["pcb_hole"] as const,
    strict: true,
    curveTolerance: 1e-6,
  }
  const holes = convertCircuitJsonToFlattenJs(nonPlatedHoles, options).elements
  const viaDrills = vias.flatMap((via) => {
    const drill: PcbHole = {
      type: "pcb_hole",
      pcb_hole_id: via.pcb_via_id,
      x: via.x,
      y: via.y,
      hole_shape: "circle",
      hole_diameter: via.hole_diameter,
    }
    return convertCircuitJsonToFlattenJs([drill], options).elements.map(
      (geometry) => ({
        ...geometry,
        elementType: "pcb_via" as const,
        sourceElement: via,
      }),
    )
  })
  return [...holes, ...viaDrills]
}

/** Uses the same physical hole boundary for overlap and clearance checks. */
export const getTraceHoleClearance = (
  trace: Pick<PcbTraceSegment, "x1" | "y1" | "x2" | "y2" | "thickness">,
  geometry: FlattenElement,
): { gap: number; center: { x: number; y: number } } => {
  const hole = geometry.sourceElement
  if (hole.type !== "pcb_hole" && hole.type !== "pcb_via") {
    throw new Error(`Expected hole geometry`)
  }
  const a = new Point(trace.x1, trace.y1)
  const b = new Point(trace.x2, trace.y2)
  let distance = Infinity
  let center = pointToSegmentClosestPoint(hole, a, b)
  if (hole.type === "pcb_via" || hole.hole_shape === "circle") {
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
