import { getPrimaryId } from "@tscircuit/circuit-json-util"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbPadPadClearanceError,
  PcbVia,
} from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { formatMm } from "format-si-unit"
import { SpatialObjectIndex } from "lib/data-structures/SpatialIndex"
import { EPSILON, getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import { getBoardOwnerResolver } from "lib/util/get-board-owner-resolver"
import { getReadableNameForElementId as getReadableNameForElement } from "lib/util/get-readable-names"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import {
  type PadElement,
  getPadBounds,
  getPadToPadGap,
  getPads,
  getViaPadClearanceCenter,
} from "./check-pad-clearance/common"

export function checkViaPadClearance(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minClearance,
  }: { connMap?: ConnectivityMap; minClearance?: number } = {},
): PcbPadPadClearanceError[] {
  const vias = circuitJson.filter(
    (element): element is PcbVia => element.type === "pcb_via",
  )
  const pads = getPads(circuitJson)
  if (vias.length === 0 || pads.length === 0) return []

  const defaultBoard = getPcbBoard(circuitJson)
  const boardsById = new Map<string, PcbBoard>(
    circuitJson.flatMap((el) =>
      el.type === "pcb_board" ? [[el.pcb_board_id, el] as const] : [],
    ),
  )
  const getBoardOwner = getBoardOwnerResolver(circuitJson)
  const getRequiredClearance = (board: PcbBoard | undefined): number =>
    minClearance ??
    getBoardDrcValue(board, "min_via_edge_to_pad_edge_clearance") ??
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

  const padIndex = new SpatialObjectIndex<PadElement>({
    objects: pads,
    getBounds: getPadBounds,
    getId: getPrimaryId,
  })
  const errors: PcbPadPadClearanceError[] = []

  for (const via of vias) {
    const viaBoardId = getBoardOwner(via)
    const searchClearance = viaBoardId
      ? getRequiredClearance(boardsById.get(viaBoardId) ?? defaultBoard)
      : maxRequiredClearance
    const nearbyPads = padIndex.getObjectsInBounds(
      getPadBounds(via),
      searchClearance,
    )

    for (const pad of nearbyPads) {
      const padId = getPrimaryId(pad)
      const padBoardId = getBoardOwner(pad)
      if (viaBoardId && padBoardId && viaBoardId !== padBoardId) continue
      if (
        !getLayersOfPcbElement(via).some((layer) =>
          getLayersOfPcbElement(pad).includes(layer),
        )
      ) {
        continue
      }
      if (connMap.areIdsConnected(via.pcb_via_id, padId)) continue

      const ownerBoardId = viaBoardId ?? padBoardId
      const owningBoard =
        (ownerBoardId ? boardsById.get(ownerBoardId) : undefined) ??
        defaultBoard
      const requiredClearance = getRequiredClearance(owningBoard)

      const gap = getPadToPadGap(via, pad)
      if (gap + EPSILON >= requiredClearance) continue

      errors.push({
        type: "pcb_pad_pad_clearance_error",
        pcb_pad_pad_clearance_error_id: `via_pad_clearance_${via.pcb_via_id}_${padId}`,
        error_type: "pcb_pad_pad_clearance_error",
        message: `Via ${getReadableNameForElement(circuitJson, via.pcb_via_id)} and pad ${getReadableNameForElement(circuitJson, padId)} are too close (clearance: ${formatMm(gap)}, minimum: ${formatMm(requiredClearance)})`,
        pcb_pad_ids: [via.pcb_via_id, padId],
        minimum_clearance: requiredClearance,
        actual_clearance: gap,
        center: getViaPadClearanceCenter(via, pad),
      })
    }
  }

  return errors
}
