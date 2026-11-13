import {
  convertCircuitJsonToFlattenJs,
  type FlattenElement,
} from "@tscircuit/circuit-json-to-flattenjs"
import { Point, Segment } from "@flatten-js/core"
import {
  pointToSegmentClosestPoint,
  pointToSegmentDistance,
} from "@tscircuit/math-utils"
import type { AnyCircuitElement } from "circuit-json"
import type { PcbTraceSegment } from "../check-each-pcb-trace-non-overlapping/getCollidableBounds"

export const getHoleGeometries = (
  circuitJson: AnyCircuitElement[],
): FlattenElement[] =>
  convertCircuitJsonToFlattenJs(
    circuitJson.filter((e) => e.type === "pcb_hole" || e.type === "pcb_via"),
    {
      // pcb_via drill holes must be covered too: via→track clearance
      // violations are otherwise invisible to checkHoleTraceClearance
      // (and to runAllRoutingChecks), while kicad-cli pcb drc flags them
      // as hole_clearance errors (JLCPCB 0.2 mm).
      elementTypes: ["pcb_hole", "pcb_via"],
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
  if (hole.type !== "pcb_hole" && hole.type !== "pcb_via") {
    throw new Error(`Expected hole geometry`)
  }
  const a = new Point(trace.x1, trace.y1)
  const b = new Point(trace.x2, trace.y2)
  let distance = Infinity
  let center = pointToSegmentClosestPoint(hole, a, b)
  // pcb_via has no hole_shape field and is always circular
  if (
    hole.type === "pcb_via" ||
    (hole.type === "pcb_hole" && hole.hole_shape === "circle")
  ) {
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
