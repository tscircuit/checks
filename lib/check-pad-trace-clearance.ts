import {
  getPrimaryId,
  getReadableNameForElement,
} from "@tscircuit/circuit-json-util"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type { AnyCircuitElement, PcbPadTraceClearanceError } from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { getCollidableBounds } from "lib/check-each-pcb-trace-non-overlapping/getCollidableBounds"
import { SpatialObjectIndex } from "lib/data-structures/SpatialIndex"
import { EPSILON, getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import {
  type PadElement,
  formatMm,
  getPadBounds,
  getPads,
  getTraceCenter,
  getTraceObstacleClearance,
  getTraceSegments,
  isTraceObstacleOverlap,
} from "./check-pad-clearance/common"

export function checkPadTraceClearance(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minClearance,
  }: { connMap?: ConnectivityMap; minClearance?: number } = {},
): PcbPadTraceClearanceError[] {
  const pads = getPads(circuitJson)
  const segments = getTraceSegments(circuitJson)
  if (pads.length === 0 || segments.length === 0) return []

  const board = getPcbBoard(circuitJson)
  minClearance ??=
    getBoardDrcValue(board, "min_trace_to_pad_edge_clearance") ??
    jlcMinTolerances.min_trace_to_pad_edge_clearance
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
  const spatialIndex = new SpatialObjectIndex<PadElement>({
    objects: pads,
    getBounds: getPadBounds,
    getId: (pad) => getPrimaryId(pad),
  })

  const errors = new Map<
    string,
    { error: PcbPadTraceClearanceError; gap: number }
  >()
  const overlappingPairIds = new Set<string>()

  for (const segment of segments) {
    const nearbyPads = spatialIndex.getObjectsInBounds(
      getCollidableBounds(segment),
      minClearance! + segment.thickness / 2,
    )

    for (const pad of nearbyPads) {
      const padId = getPrimaryId(pad)
      if (!getLayersOfPcbElement(pad as any).includes(segment.layer)) continue
      if (connMap.areIdsConnected(segment.pcb_trace_id, padId)) continue
      const pairId = `${padId}_${segment.pcb_trace_id}`
      const { gap } = getTraceObstacleClearance(segment, pad)
      if (isTraceObstacleOverlap(gap)) {
        errors.delete(pairId)
        overlappingPairIds.add(pairId)
        continue
      }
      if (overlappingPairIds.has(pairId)) continue
      if (gap + EPSILON >= minClearance!) continue

      const nextError: PcbPadTraceClearanceError = {
        type: "pcb_pad_trace_clearance_error" as const,
        pcb_pad_trace_clearance_error_id: `pad_trace_clearance_${pairId}`,
        error_type: "pcb_pad_trace_clearance_error",
        message: `Pad ${getReadableNameForElement(circuitJson, padId)} and trace ${getReadableNameForElement(circuitJson, segment.pcb_trace_id)} are too close (clearance: ${formatMm(gap)}, minimum: ${formatMm(minClearance!)})`,
        pcb_pad_id: padId,
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
