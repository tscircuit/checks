import { getReadableNameForElementId as getReadableNameForElement } from "lib/util/get-readable-names"
import { getPrimaryId } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbPadPadClearanceError,
} from "circuit-json"
import { formatMm } from "format-si-unit"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { SpatialObjectIndex } from "lib/data-structures/SpatialIndex"
import { EPSILON, getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import { getBoardOwnerResolver } from "lib/util/get-board-owner-resolver"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import {
  type PadElement,
  getPadBounds,
  getPadCenter,
  getPadToPadGap,
  getPads,
} from "./check-pad-clearance/common"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"

export function checkPadPadClearance(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minClearance,
  }: { connMap?: ConnectivityMap; minClearance?: number } = {},
): PcbPadPadClearanceError[] {
  const pads = getPads(circuitJson)
  if (pads.length < 2) return []

  const defaultBoard = getPcbBoard(circuitJson)
  const boardsById = new Map<string, PcbBoard>(
    circuitJson.flatMap((el) =>
      el.type === "pcb_board" ? [[el.pcb_board_id, el] as const] : [],
    ),
  )
  const getBoardOwner = getBoardOwnerResolver(circuitJson)
  const getRequiredClearance = (board: PcbBoard | undefined): number =>
    minClearance ??
    getBoardDrcValue(board, "min_pad_edge_to_pad_edge_clearance") ??
    jlcMinTolerances.min_pad_edge_to_pad_edge_clearance!
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

  const errors = new Map<string, PcbPadPadClearanceError>()

  for (const padA of pads) {
    const padAId = getPrimaryId(padA)
    const padABoardId = getBoardOwner(padA)
    const searchClearance = padABoardId
      ? getRequiredClearance(boardsById.get(padABoardId) ?? defaultBoard)
      : maxRequiredClearance
    const nearbyPads = spatialIndex.getObjectsInBounds(
      getPadBounds(padA),
      searchClearance,
    )

    for (const padB of nearbyPads) {
      const padBId = getPrimaryId(padB)
      if (padAId === padBId) continue
      const padBBoardId = getBoardOwner(padB)
      if (padABoardId && padBBoardId && padABoardId !== padBBoardId) continue
      if (
        !getLayersOfPcbElement(padA as any).some((layer) =>
          getLayersOfPcbElement(padB as any).includes(layer),
        )
      ) {
        continue
      }
      if (connMap.areIdsConnected(padAId, padBId)) continue

      const ownerBoardId = padABoardId ?? padBBoardId
      const owningBoard =
        (ownerBoardId ? boardsById.get(ownerBoardId) : undefined) ??
        defaultBoard
      const requiredClearance = getRequiredClearance(owningBoard)

      const pairId = [padAId, padBId].sort().join("_")
      const gap = getPadToPadGap(padA, padB)
      if (gap + EPSILON >= requiredClearance) continue
      const centerA = getPadCenter(padA)
      const centerB = getPadCenter(padB)

      const nextError: PcbPadPadClearanceError = {
        type: "pcb_pad_pad_clearance_error",
        pcb_pad_pad_clearance_error_id: `pad_pad_clearance_${pairId}`,
        error_type: "pcb_pad_pad_clearance_error",
        message: `Pads ${getReadableNameForElement(circuitJson, padAId)} and ${getReadableNameForElement(circuitJson, padBId)} are too close (clearance: ${formatMm(gap)}, minimum: ${formatMm(requiredClearance)})`,
        pcb_pad_ids: [padAId, padBId] as [string, string],
        minimum_clearance: requiredClearance,
        actual_clearance: gap,
        center: {
          x: (centerA.x + centerB.x) / 2,
          y: (centerA.y + centerB.y) / 2,
        },
      }

      if (!errors.has(pairId)) {
        errors.set(pairId, nextError)
      }
    }
  }

  return Array.from(errors.values())
}
