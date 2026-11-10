import { getReadableNameForElementId as getReadableNameForElement } from "lib/util/get-readable-names"
import { getPrimaryId } from "@tscircuit/circuit-json-util"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type { AnyCircuitElement, PcbPadTraceClearanceError } from "circuit-json"
import { formatMm } from "format-si-unit"
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
  getPadBounds,
  getPads,
  getTraceObstacleClearance,
  getTraceSegments,
  isTraceObstacleOverlap,
} from "./check-pad-clearance/common"
import {
  type ClearanceMatrix,
  type NetClassClearanceManager,
  type NetClassDefinition,
  createNetClassClearanceManager,
} from "./net-classes"

export function checkPadTraceClearance(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minClearance,
    netClasses,
    clearanceMatrix,
    clearanceManager,
  }: {
    connMap?: ConnectivityMap
    minClearance?: number
    netClasses?: NetClassDefinition[]
    clearanceMatrix?: ClearanceMatrix
    clearanceManager?: NetClassClearanceManager
  } = {},
): PcbPadTraceClearanceError[] {
  const pads = getPads(circuitJson)
  const segments = getTraceSegments(circuitJson)
  if (pads.length === 0 || segments.length === 0) return []

  const board = getPcbBoard(circuitJson)
  minClearance ??=
    getBoardDrcValue(board, "min_trace_to_pad_edge_clearance") ??
    jlcMinTolerances.min_trace_to_pad_edge_clearance
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
  clearanceManager ??= createNetClassClearanceManager(circuitJson, {
    connMap,
    minClearance,
    netClasses,
    clearanceMatrix,
  })
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
    const searchRadius =
      clearanceManager.getMaxClearanceForId(
        segment.pcb_trace_id,
        minClearance!,
      ) +
      segment.thickness / 2
    const nearbyPads = spatialIndex.getObjectsInBounds(
      getCollidableBounds(segment),
      searchRadius,
    )

    for (const pad of nearbyPads) {
      const padId = getPrimaryId(pad)
      if (!getLayersOfPcbElement(pad as any).includes(segment.layer)) continue
      if (connMap.areIdsConnected(segment.pcb_trace_id, padId)) continue
      const pairId = `${padId}_${segment.pcb_trace_id}`
      const { gap, center } = getTraceObstacleClearance(segment, pad)
      if (isTraceObstacleOverlap(gap)) {
        errors.delete(pairId)
        overlappingPairIds.add(pairId)
        continue
      }
      if (overlappingPairIds.has(pairId)) continue
      const requiredClearance = clearanceManager.getRequiredClearance(
        segment.pcb_trace_id,
        padId,
        minClearance!,
      )
      if (gap + EPSILON >= requiredClearance) continue

      const nextError: PcbPadTraceClearanceError = {
        type: "pcb_pad_trace_clearance_error" as const,
        pcb_pad_trace_clearance_error_id: `pad_trace_clearance_${pairId}`,
        error_type: "pcb_pad_trace_clearance_error",
        message: `Pad ${getReadableNameForElement(circuitJson, padId)} and trace ${getReadableNameForElement(circuitJson, segment.pcb_trace_id)} are too close (clearance: ${formatMm(gap)}, minimum: ${formatMm(requiredClearance)})`,
        pcb_pad_id: padId,
        pcb_trace_id: segment.pcb_trace_id,
        minimum_clearance: requiredClearance,
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
