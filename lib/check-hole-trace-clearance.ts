import {
  getReadableNameForElementId,
  getReadableNameForTrace,
} from "lib/util/get-readable-names"
import {
  getHoleGeometries,
  getTraceHoleClearance,
} from "./check-hole-clearance/common"
import { isTraceObstacleOverlap } from "./check-pad-clearance/common"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type { AnyCircuitElement, PcbTraceError, PcbVia } from "circuit-json"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { getBoardDrcValue, getPcbBoard } from "./drc-defaults"
import { SpatialObjectIndex } from "./data-structures/SpatialIndex"
import { getLayersOfPcbElement } from "./util/getLayersOfPcbElement"

// Copper layers run from top through inner1..innerN to bottom; vias may
// span the whole board or only a subset (e.g. a blind/buried via).
const layerRank = (layer: string): number | undefined => {
  if (layer === "top") return 0
  if (layer === "bottom") return Number.POSITIVE_INFINITY
  const inner = /^inner(\d+)$/.exec(layer)
  return inner ? Number(inner[1]) : undefined
}
const viaSpansLayer = (via: PcbVia, layer: string): boolean => {
  if (!via.layers?.length) return true
  const rank = layerRank(layer)
  const viaRanks = via.layers.map(layerRank)
  if (rank === undefined || viaRanks.some((v) => v === undefined)) {
    return via.layers.includes(layer as (typeof via.layers)[number])
  }
  const ranks = viaRanks as number[]
  return rank >= Math.min(...ranks) && rank <= Math.max(...ranks)
}

/** Checks trace copper against physical non-plated and via drill edges. */
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
  const holes = getHoleGeometries(circuitJson, { includeVias: true })
  const connectivity = circuitJson.some((element) => element.type === "pcb_via")
    ? getFullConnectivityMapFromCircuitJson(circuitJson)
    : undefined
  if (holes.length === 0) return []
  const index = new SpatialObjectIndex({
    objects: holes,
    getId: (hole) => `${hole.elementType}:${hole.elementId}`,
    getBounds: (hole) => ({
      minX: hole.bounds.xmin,
      minY: hole.bounds.ymin,
      maxX: hole.bounds.xmax,
      maxY: hole.bounds.ymax,
    }),
  })
  const errors = new Map<string, { gap: number; error: PcbTraceError }>()
  const overlappingPairIds = new Set<string>()
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
        if (hole.type !== "pcb_hole" && hole.type !== "pcb_via") continue
        const layer =
          a.route_type === "wire"
            ? a.layer
            : b.route_type === "wire"
              ? b.layer
              : undefined
        if (
          hole.type === "pcb_via" &&
          (!layer ||
            (a.x === b.x && a.y === b.y) ||
            !viaSpansLayer(hole, layer) ||
            hole.pcb_trace_id === trace.pcb_trace_id ||
            connectivity?.areIdsConnected(hole.pcb_via_id, trace.pcb_trace_id))
        )
          continue
        const { gap, center } = getTraceHoleClearance(
          { x1: a.x, y1: a.y, x2: b.x, y2: b.y, thickness: halfWidth * 2 },
          geometry,
        )
        const holeId =
          hole.type === "pcb_via" ? hole.pcb_via_id : hole.pcb_hole_id
        const pairId = `${trace.pcb_trace_id}_${holeId}`
        const pairKey = `${hole.type}:${pairId}`
        const overlapCoveredByExistingCheck =
          hole.type === "pcb_hole"
            ? isTraceObstacleOverlap(gap)
            : Boolean(
                layer &&
                  getLayersOfPcbElement(hole).includes(layer) &&
                  isTraceObstacleOverlap(
                    gap - (hole.outer_diameter - hole.hole_diameter) / 2,
                  ),
              )
        if (overlapCoveredByExistingCheck) {
          // Existing overlap checks report NPTH drill collisions and via
          // copper collisions on explicitly listed layers. Intermediate
          // layers in a via span are not covered there: retain those errors.
          errors.delete(pairKey)
          overlappingPairIds.add(pairKey)
          continue
        }
        if (overlappingPairIds.has(pairKey)) continue
        if (gap + 1e-6 >= required) continue
        if ((errors.get(pairKey)?.gap ?? Infinity) <= gap) continue
        errors.set(pairKey, {
          gap,
          error: {
            type: "pcb_trace_error",
            error_type: "pcb_trace_error",
            pcb_trace_error_id:
              hole.type === "pcb_via"
                ? `via_drill_clearance_${pairId}`
                : `overlap_${pairId}`,
            pcb_trace_id: trace.pcb_trace_id,
            source_trace_id: trace.source_trace_id ?? "",
            pcb_component_ids:
              hole.type === "pcb_hole" && hole.pcb_component_id
                ? [hole.pcb_component_id]
                : [],
            pcb_port_ids: [],
            center,
            message: `Trace ${getReadableNameForTrace(circuitJson, trace.pcb_trace_id)} is too close to ${hole.type === "pcb_via" ? "via drill" : "non-plated hole"} ${getReadableNameForElementId(circuitJson, holeId)} (gap: ${gap.toFixed(6)}mm, required: ${required}mm)`,
          },
        })
      }
    }
  }
  return Array.from(errors.values(), ({ error }) => error)
}
