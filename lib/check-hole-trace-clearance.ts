import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type { AnyCircuitElement, PcbTraceError } from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import {
  getReadableNameForElementId,
  getReadableNameForTrace,
} from "lib/util/get-readable-names"
import {
  getHoleGeometries,
  getTraceHoleClearance,
} from "./check-hole-clearance/common"
import { isTraceObstacleOverlap } from "./check-pad-clearance/common"
import { SpatialObjectIndex } from "./data-structures/SpatialIndex"
import { getBoardDrcValue, getPcbBoard } from "./drc-defaults"
import { getLayersOfPcbElement } from "./util/getLayersOfPcbElement"

/** Checks trace copper against physical holes (non-plated holes and via drill holes) on every copper layer. */
export function checkHoleTraceClearance(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minClearance,
  }: { connMap?: ConnectivityMap; minClearance?: number } = {},
): PcbTraceError[] {
  const board = getPcbBoard(circuitJson)
  const explicitHoleClearance =
    minClearance ?? getBoardDrcValue(board, "min_trace_to_hole_edge_clearance")
  const required =
    explicitHoleClearance ?? jlcMinTolerances.min_trace_to_hole_edge_clearance!
  const deferViaPadLayerToViaClearance =
    minClearance === undefined &&
    board !== undefined &&
    (explicitHoleClearance === undefined ||
      explicitHoleClearance ===
        jlcMinTolerances.min_trace_to_hole_edge_clearance) &&
    getBoardDrcValue(board, "min_trace_to_pad_edge_clearance") !== undefined &&
    (board.width ?? 0) < 85
  const minCopperClearance =
    getBoardDrcValue(board, "min_trace_to_pad_edge_clearance") ??
    jlcMinTolerances.min_trace_to_pad_edge_clearance!
  if (!Number.isFinite(required) || required < 0) {
    throw new Error("Trace-to-hole clearance must be finite and non-negative")
  }
  const holes = getHoleGeometries(circuitJson)
  if (holes.length === 0) return []
  if (holes.some((h) => h.sourceElement.type === "pcb_via")) {
    connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
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
      const wireLayer = a.route_type === "wire" ? a.layer : (b as any).layer
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
        const holeId =
          hole.type === "pcb_hole" ? hole.pcb_hole_id : hole.pcb_via_id
        if (
          hole.type === "pcb_via" &&
          (hole.pcb_trace_id === trace.pcb_trace_id ||
            connMap?.areIdsConnected(trace.pcb_trace_id, holeId))
        )
          continue
        const { gap, center } = getTraceHoleClearance(
          { x1: a.x, y1: a.y, x2: b.x, y2: b.y, thickness: halfWidth * 2 },
          geometry,
        )
        const pairId = `${trace.pcb_trace_id}_${holeId}`
        const isViaOnWireLayer =
          hole.type === "pcb_via" &&
          Boolean(wireLayer) &&
          getLayersOfPcbElement(hole).includes(wireLayer)
        const copperGap = isViaOnWireLayer
          ? gap - Math.max(0, (hole.outer_diameter - hole.hole_diameter) / 2)
          : gap
        if (
          isTraceObstacleOverlap(copperGap) ||
          (isViaOnWireLayer &&
            (deferViaPadLayerToViaClearance ||
              (minClearance === undefined &&
                copperGap + 1e-6 < minCopperClearance)))
        ) {
          errors.delete(pairId)
          overlappingPairIds.add(pairId)
          continue
        }
        if (overlappingPairIds.has(pairId)) continue
        if (gap + 1e-6 >= required) continue
        if ((errors.get(pairId)?.gap ?? Number.POSITIVE_INFINITY) <= gap)
          continue
        const holeLabel =
          hole.type === "pcb_hole"
            ? `non-plated hole ${getReadableNameForElementId(circuitJson, holeId)}`
            : `via hole ${getReadableNameForElementId(circuitJson, holeId)}`
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
            message: `Trace ${getReadableNameForTrace(circuitJson, trace.pcb_trace_id)} is too close to ${holeLabel} (gap: ${gap.toFixed(6)}mm, required: ${required}mm)`,
          },
        })
      }
    }
  }
  return Array.from(errors.values(), ({ error }) => error)
}
