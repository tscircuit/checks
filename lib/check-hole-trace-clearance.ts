import { convertCircuitJsonToFlattenJs } from "@tscircuit/circuit-json-to-flattenjs"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import {
  pointToSegmentClosestPoint,
  pointToSegmentDistance,
} from "@tscircuit/math-utils"
import { Point, Segment } from "@flatten-js/core"
import type { AnyCircuitElement, PcbTraceError } from "circuit-json"
import { getBoardDrcValue, getPcbBoard } from "./drc-defaults"
import { SpatialObjectIndex } from "./data-structures/SpatialIndex"

/** Checks trace copper against physical non-plated holes on every copper layer. */
export function checkHoleTraceClearance(
  circuitJson: AnyCircuitElement[],
  { minClearance }: { minClearance?: number } = {},
): PcbTraceError[] {
  const required =
    minClearance ??
    getBoardDrcValue(
      getPcbBoard(circuitJson),
      "min_trace_to_hole_edge_clearance",
    ) ??
    jlcMinTolerances.min_trace_to_hole_edge_clearance!
  if (!Number.isFinite(required) || required < 0) {
    throw new Error("Trace-to-hole clearance must be finite and non-negative")
  }
  const holes = convertCircuitJsonToFlattenJs(circuitJson, {
    elementTypes: ["pcb_hole"],
    strict: true,
    curveTolerance: 1e-6,
  }).elements
  if (holes.length === 0) return []
  const index = new SpatialObjectIndex({
    objects: holes,
    getId: (hole) => hole.elementId,
    getBounds: (hole) => ({
      minX: hole.bounds.xmin,
      minY: hole.bounds.ymin,
      maxX: hole.bounds.xmax,
      maxY: hole.bounds.ymax,
    }),
  })
  const errors = new Map<string, { gap: number; error: PcbTraceError }>()
  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace") continue
    for (let i = 1; i < trace.route.length; i++) {
      const a = trace.route[i - 1]!
      const b = trace.route[i]!
      if (
        (a.route_type !== "wire" && a.route_type !== "via") ||
        (b.route_type !== "wire" && b.route_type !== "via")
      )
        continue
      if (a.route_type !== "wire" && b.route_type !== "wire") continue
      if (
        a.route_type === "wire" &&
        b.route_type === "wire" &&
        a.layer !== b.layer
      )
        continue
      const halfWidth =
        Math.max(
          a.route_type === "wire" ? a.width : 0,
          b.route_type === "wire" ? b.width : 0,
        ) / 2
      const start = new Point(a.x, a.y)
      const end = new Point(b.x, b.y)
      const segment = new Segment(start, end)
      const candidates = index.getObjectsInBounds(
        {
          minX: Math.min(a.x, b.x),
          minY: Math.min(a.y, b.y),
          maxX: Math.max(a.x, b.x),
          maxY: Math.max(a.y, b.y),
        },
        required + halfWidth,
      )
      for (const geometry of candidates) {
        const hole = geometry.sourceElement
        if (hole.type !== "pcb_hole") continue
        let distance = Infinity
        let center = pointToSegmentClosestPoint(hole, a, b)
        if (hole.hole_shape === "circle") {
          distance = pointToSegmentDistance(hole, a, b) - hole.hole_diameter / 2
        } else {
          for (const shape of geometry.shapes) {
            const [boundaryDistance, shortest] = shape.distanceTo(segment)
            const shapeDistance =
              shape.contains(start) || shape.contains(end)
                ? 0
                : boundaryDistance
            if (shapeDistance < distance) {
              distance = shapeDistance
              center = shortest.end
            }
          }
        }
        const gap = distance - halfWidth
        if (gap + 1e-6 >= required) continue
        const pairId = `${trace.pcb_trace_id}_${hole.pcb_hole_id}`
        if ((errors.get(pairId)?.gap ?? Infinity) <= gap) continue
        errors.set(pairId, {
          gap,
          error: {
            type: "pcb_trace_error",
            error_type: "pcb_trace_error",
            pcb_trace_error_id: `overlap_${pairId}`,
            pcb_trace_id: trace.pcb_trace_id,
            source_trace_id: trace.source_trace_id ?? "",
            pcb_component_ids: hole.pcb_component_id
              ? [hole.pcb_component_id]
              : [],
            pcb_port_ids: [],
            center,
            message: `Trace ${trace.pcb_trace_id} is too close to non-plated hole ${hole.pcb_hole_id} (gap: ${gap.toFixed(6)}mm, required: ${required}mm)`,
          },
        })
      }
    }
  }
  return Array.from(errors.values(), ({ error }) => error)
}
