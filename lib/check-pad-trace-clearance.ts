import { getReadableNameForElementId as getReadableNameForElement } from "lib/util/get-readable-names"
import { getPrimaryId } from "@tscircuit/circuit-json-util"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbPadTraceClearanceError,
  PcbTrace,
} from "circuit-json"
import { formatMm } from "format-si-unit"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { getCollidableBounds } from "lib/check-each-pcb-trace-non-overlapping/getCollidableBounds"
import { SpatialObjectIndex } from "lib/data-structures/SpatialIndex"
import { EPSILON, getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import { getBoardOwnerResolver } from "lib/util/get-board-owner-resolver"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import {
  type PadElement,
  getPadBounds,
  getPads,
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

  const defaultBoard = getPcbBoard(circuitJson)
  const boardsById = new Map<string, PcbBoard>(
    circuitJson.flatMap((el) =>
      el.type === "pcb_board" ? [[el.pcb_board_id, el] as const] : [],
    ),
  )
  const tracesById = new Map<string, PcbTrace>(
    circuitJson.flatMap((el) =>
      el.type === "pcb_trace" ? [[el.pcb_trace_id, el] as const] : [],
    ),
  )
  const getBoardOwner = getBoardOwnerResolver(circuitJson)
  const getRequiredClearance = (board: PcbBoard | undefined): number =>
    minClearance ??
    getBoardDrcValue(board, "min_trace_to_pad_edge_clearance") ??
    jlcMinTolerances.min_trace_to_pad_edge_clearance!
  let maxRequiredClearance = getRequiredClearance(defaultBoard)
  for (const board of boardsById.values()) {
    maxRequiredClearance = Math.max(
      maxRequiredClearance,
      getRequiredClearance(board),
    )
  }
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
    const trace = tracesById.get(segment.pcb_trace_id)
    const traceBoardId = trace ? getBoardOwner(trace) : undefined
    const searchClearance = traceBoardId
      ? getRequiredClearance(boardsById.get(traceBoardId) ?? defaultBoard)
      : maxRequiredClearance
    const nearbyPads = spatialIndex.getObjectsInBounds(
      getCollidableBounds(segment),
      searchClearance + segment.thickness / 2,
    )

    for (const pad of nearbyPads) {
      const padId = getPrimaryId(pad)
      const padBoardId = getBoardOwner(pad)
      if (padBoardId && traceBoardId && padBoardId !== traceBoardId) continue
      if (!getLayersOfPcbElement(pad as any).includes(segment.layer)) continue
      if (connMap.areIdsConnected(segment.pcb_trace_id, padId)) continue

      const ownerBoardId = padBoardId ?? traceBoardId
      const owningBoard =
        (ownerBoardId ? boardsById.get(ownerBoardId) : undefined) ??
        defaultBoard
      const requiredClearance = getRequiredClearance(owningBoard)

      const pairId = `${padId}_${segment.pcb_trace_id}`
      const { gap, center } = getTraceObstacleClearance(segment, pad)
      if (isTraceObstacleOverlap(gap)) {
        errors.delete(pairId)
        overlappingPairIds.add(pairId)
        continue
      }
      if (overlappingPairIds.has(pairId)) continue
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
