import { getReadableNameForElementId as getReadableNameForElement } from "lib/util/get-readable-names"

import type {
  AnyCircuitElement,
  PcbBoard,
  PcbVia,
  PcbViaClearanceError,
} from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { EPSILON, getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import { distance } from "lib/util/distance"
import { getBoardOwnerResolver } from "lib/util/get-board-owner-resolver"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"

export function checkDifferentNetViaSpacing(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minClearance,
  }: { connMap?: ConnectivityMap; minClearance?: number } = {},
): PcbViaClearanceError[] {
  const vias = circuitJson.filter((el) => el.type === "pcb_via") as PcbVia[]
  if (vias.length < 2) return []
  const defaultBoard = getPcbBoard(circuitJson)
  const boardsById = new Map<string, PcbBoard>(
    circuitJson.flatMap((el) =>
      el.type === "pcb_board" ? [[el.pcb_board_id, el] as const] : [],
    ),
  )
  const getBoardOwner = getBoardOwnerResolver(circuitJson)
  const getRequiredHoleClearance = (board: PcbBoard | undefined): number =>
    minClearance ??
    getBoardDrcValue(board, "min_via_hole_edge_to_via_hole_edge_clearance") ??
    jlcMinTolerances.min_via_hole_edge_to_via_hole_edge_clearance!
  const getRequiredCopperClearance = (board: PcbBoard | undefined): number =>
    getBoardDrcValue(board, "min_pad_edge_to_pad_edge_clearance") ??
    jlcMinTolerances.min_pad_edge_to_pad_edge_clearance!
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
  const errors: PcbViaClearanceError[] = []
  const reported = new Set<string>()

  for (let i = 0; i < vias.length; i++) {
    const viaA = vias[i]
    const viaABoardId = getBoardOwner(viaA)
    for (let j = i + 1; j < vias.length; j++) {
      const viaB = vias[j]
      const viaBBoardId = getBoardOwner(viaB)
      if (viaABoardId && viaBBoardId && viaABoardId !== viaBBoardId) continue
      // TODO: It is a very inefficient piece of code, the way to fix it is to use flatbush.
      if (connMap.areIdsConnected(viaA.pcb_via_id, viaB.pcb_via_id)) continue
      const ownerBoardId = viaABoardId ?? viaBBoardId
      const owningBoard =
        (ownerBoardId ? boardsById.get(ownerBoardId) : undefined) ??
        defaultBoard
      const minHoleClearance = getRequiredHoleClearance(owningBoard)
      const minCopperClearance = getRequiredCopperClearance(owningBoard)
      const centerDistance = distance(viaA, viaB)
      let gap = centerDistance - viaA.hole_diameter / 2 - viaB.hole_diameter / 2
      let minimumClearance = minHoleClearance
      if (gap + EPSILON >= minimumClearance) {
        if (!viaA.layers.some((layer) => viaB.layers.includes(layer))) continue
        gap = centerDistance - viaA.outer_diameter / 2 - viaB.outer_diameter / 2
        minimumClearance = minCopperClearance
        // A negative copper gap is a short, even within the clearance tolerance.
        if (gap >= 0 && gap + EPSILON >= minimumClearance) continue
      }
      const pairId = [viaA.pcb_via_id, viaB.pcb_via_id].sort().join("_")
      if (reported.has(pairId)) continue
      reported.add(pairId)
      errors.push({
        type: "pcb_via_clearance_error",
        pcb_error_id: `different_net_vias_close_${pairId}`,
        message: `Vias ${getReadableNameForElement(
          circuitJson,
          viaA.pcb_via_id,
        )} and ${getReadableNameForElement(
          circuitJson,
          viaB.pcb_via_id,
        )} from different nets are too close together (gap: ${gap.toFixed(
          3,
        )}mm)`,
        error_type: "pcb_via_clearance_error",
        pcb_via_ids: [viaA.pcb_via_id, viaB.pcb_via_id],
        minimum_clearance: minimumClearance,
        actual_clearance: gap,
        pcb_center: {
          x: (viaA.x + viaB.x) / 2,
          y: (viaA.y + viaB.y) / 2,
        },
      })
    }
  }

  return errors
}
