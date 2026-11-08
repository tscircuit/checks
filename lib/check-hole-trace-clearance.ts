import {
  getReadableNameForElementId,
  getReadableNameForTrace,
} from "lib/util/get-readable-names"
import {
  getHoleGeometries,
  getTraceHoleClearance,
} from "./check-hole-clearance/common"
import {
  getTraceObstacleClearance,
  isTraceObstacleOverlap,
} from "./check-pad-clearance/common"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type { AnyCircuitElement, PcbTraceError } from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { addStartAndEndPortIdsIfMissing } from "./add-start-and-end-port-ids-if-missing"
import { getBoardDrcValue, getPcbBoard } from "./drc-defaults"
import { SpatialObjectIndex } from "./data-structures/SpatialIndex"

/** Checks trace copper against physical non-plated holes and via drill holes on every copper layer. */
export function checkHoleTraceClearance(
  circuitJson: AnyCircuitElement[],
  {
    minClearance,
    connMap,
  }: { minClearance?: number; connMap?: ConnectivityMap } = {},
): PcbTraceError[] {
  const board = getPcbBoard(circuitJson)
  const boardHoleClearance = getBoardDrcValue(
    board,
    "min_trace_to_hole_edge_clearance",
  )
  const required =
    minClearance ??
    boardHoleClearance ??
    jlcMinTolerances.min_trace_to_hole_edge_clearance!
  if (!Number.isFinite(required) || required < 0) {
    throw new Error("Trace-to-hole clearance must be finite and non-negative")
  }
  const minPadClearance =
    getBoardDrcValue(board, "min_trace_to_pad_edge_clearance") ??
    jlcMinTolerances.min_trace_to_pad_edge_clearance!
  const checkVias = minClearance !== undefined || boardHoleClearance !== undefined
  const holes = getHoleGeometries(circuitJson)
  if (holes.length === 0) return []
  let resolvedConnMap = connMap
  const getConnMap = () => {
    if (!resolvedConnMap) {
      addStartAndEndPortIdsIfMissing(circuitJson)
      resolvedConnMap = getFullConnectivityMapFromCircuitJson(circuitJson)
    }
    return resolvedConnMap
  }
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
      const wire = a.route_type === "wire" ? a : b
      if (wire.route_type !== "wire") continue
      const halfWidth =
        Math.max(wire.width, wire.start_width ?? 0, wire.end_width ?? 0) / 2
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
        if (hole.type === "pcb_via") {
          if (!checkVias) continue
          if (hole.pcb_trace_id === trace.pcb_trace_id) continue
          if (getConnMap().areIdsConnected(trace.pcb_trace_id, hole.pcb_via_id))
            continue
          const { gap: padGap } = getTraceObstacleClearance(
            { x1: a.x, y1: a.y, x2: b.x, y2: b.y, thickness: halfWidth * 2 },
            hole,
          )
          if (padGap < minPadClearance) continue
        }
        const holeId =
          hole.type === "pcb_hole" ? hole.pcb_hole_id : hole.pcb_via_id
        const { gap, center } = getTraceHoleClearance(
          { x1: a.x, y1: a.y, x2: b.x, y2: b.y, thickness: halfWidth * 2 },
          geometry,
        )
        const pairId = `${trace.pcb_trace_id}_${holeId}`
        if (isTraceObstacleOverlap(gap)) {
          errors.delete(pairId)
          overlappingPairIds.add(pairId)
          continue
        }
        if (overlappingPairIds.has(pairId)) continue
        if (gap + 1e-6 >= required) continue
        if ((errors.get(pairId)?.gap ?? Infinity) <= gap) continue
        errors.set(pairId, {
          gap,
          error: {
            type: "pcb_trace_error",
            error_type: "pcb_trace_error",
            pcb_trace_error_id: `overlap_${pairId}`,
            pcb_trace_id: trace.pcb_trace_id,
            source_trace_id: trace.source_trace_id ?? "",
            pcb_component_ids:
              "pcb_component_id" in hole && hole.pcb_component_id
                ? [hole.pcb_component_id]
                : [],
            pcb_port_ids: [],
            center,
            message: `Trace ${getReadableNameForTrace(circuitJson, trace.pcb_trace_id)} is too close to ${hole.type === "pcb_via" ? "via hole" : "non-plated hole"} ${getReadableNameForElementId(circuitJson, holeId)} (gap: ${gap.toFixed(6)}mm, required: ${required}mm)`,
          },
        })
      }
    }
  }
  return Array.from(errors.values(), ({ error }) => error)
}
