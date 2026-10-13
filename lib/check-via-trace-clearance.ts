import { getReadableNameForElementId as getReadableNameForElement } from "lib/util/get-readable-names"

import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  PcbVia,
  PcbViaTraceClearanceError,
} from "circuit-json"
import { formatMm } from "format-si-unit"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { EPSILON, getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import {
  getTraceObstacleClearance,
  getTraceSegments,
  isTraceObstacleOverlap,
} from "./check-pad-clearance/common"

export function checkViaTraceClearance(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minClearance,
  }: { connMap?: ConnectivityMap; minClearance?: number } = {},
): PcbViaTraceClearanceError[] {
  const vias = circuitJson.filter((el) => el.type === "pcb_via") as PcbVia[]
  const segments = getTraceSegments(circuitJson).map((segment) => ({
    ...segment,
    minX: Math.min(segment.x1, segment.x2),
    maxX: Math.max(segment.x1, segment.x2),
    minY: Math.min(segment.y1, segment.y2),
    maxY: Math.max(segment.y1, segment.y2),
    radius: Math.max(0, segment.thickness / 2),
    finiteBounds:
      Number.isFinite(segment.x1) &&
      Number.isFinite(segment.x2) &&
      Number.isFinite(segment.y1) &&
      Number.isFinite(segment.y2) &&
      Number.isFinite(segment.thickness),
  }))
  if (vias.length === 0 || segments.length === 0) return []

  const board = getPcbBoard(circuitJson)
  minClearance ??=
    getBoardDrcValue(board, "min_trace_to_pad_edge_clearance") ??
    jlcMinTolerances.min_trace_to_pad_edge_clearance
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
  const errors = new Map<
    string,
    { error: PcbViaTraceClearanceError; gap: number }
  >()
  const overlappingPairIds = new Set<string>()

  for (const via of vias) {
    const layers = getLayersOfPcbElement(via)
    const finiteBounds =
      Number.isFinite(via.x) &&
      Number.isFinite(via.y) &&
      Number.isFinite(via.outer_diameter) &&
      Number.isFinite(minClearance)
    const radius =
      Math.max(0, via.outer_diameter / 2) + Math.max(0, minClearance!) + EPSILON
    for (const segment of segments) {
      const expansion = radius + segment.radius
      // Conservative bounds retain every overlap and clearance hit.
      if (
        finiteBounds &&
        segment.finiteBounds &&
        (via.x < segment.minX - expansion ||
          via.x > segment.maxX + expansion ||
          via.y < segment.minY - expansion ||
          via.y > segment.maxY + expansion)
      )
        continue
      if (!layers.includes(segment.layer)) continue
      if (connMap.areIdsConnected(segment.pcb_trace_id, via.pcb_via_id))
        continue

      const pairId = `${via.pcb_via_id}_${segment.pcb_trace_id}`
      const { gap, center } = getTraceObstacleClearance(segment, via)
      if (isTraceObstacleOverlap(gap)) {
        errors.delete(pairId)
        overlappingPairIds.add(pairId)
        continue
      }
      if (overlappingPairIds.has(pairId)) continue
      if (gap + EPSILON >= minClearance!) continue

      const nextError: PcbViaTraceClearanceError = {
        type: "pcb_via_trace_clearance_error",
        pcb_via_trace_clearance_error_id: `via_trace_clearance_${pairId}`,
        error_type: "pcb_via_trace_clearance_error",
        message: `Via ${getReadableNameForElement(circuitJson, via.pcb_via_id)} and trace ${getReadableNameForElement(circuitJson, segment.pcb_trace_id)} are too close (clearance: ${formatMm(gap)}, minimum: ${formatMm(minClearance!)})`,
        pcb_via_id: via.pcb_via_id,
        pcb_trace_id: segment.pcb_trace_id,
        minimum_clearance: minClearance,
        actual_clearance: gap,
        center,
      }

      const current = errors.get(pairId)
      if (!current || gap < current.gap) {
        errors.set(pairId, { error: nextError, gap })
      }
    }
  }

  return Array.from(errors.values()).map(({ error }) => error)
}
