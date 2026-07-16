import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PcbVia,
  PcbViaTraceClearanceError,
} from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import {
  DEFAULT_PAD_TRACE_CLEARANCE,
  EPSILON,
  getBoardDrcValue,
  getPcbBoard,
} from "lib/drc-defaults"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import {
  formatMm,
  getTraceCenter,
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
  const segments = getTraceSegments(circuitJson)
  if (vias.length === 0 || segments.length === 0) return []

  const board = getPcbBoard(circuitJson)
  minClearance ??=
    getBoardDrcValue(board, "min_trace_to_pad_edge_clearance") ??
    DEFAULT_PAD_TRACE_CLEARANCE
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
  const errors = new Map<
    string,
    { error: PcbViaTraceClearanceError; gap: number }
  >()
  const overlappingPairIds = new Set<string>()

  for (const via of vias) {
    for (const segment of segments) {
      if (!getLayersOfPcbElement(via).includes(segment.layer)) continue
      if (connMap.areIdsConnected(segment.pcb_trace_id, via.pcb_via_id))
        continue

      const pairId = `${via.pcb_via_id}_${segment.pcb_trace_id}`
      const { gap } = getTraceObstacleClearance(segment, via)
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
        center: getTraceCenter(segment),
      }

      const current = errors.get(pairId)
      if (!current || gap < current.gap) {
        errors.set(pairId, { error: nextError, gap })
      }
    }
  }

  return Array.from(errors.values()).map(({ error }) => error)
}
