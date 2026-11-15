import { getReadableNameForElementId as getReadableNameForElement } from "lib/util/get-readable-names"

import type {
  AnyCircuitElement,
  PcbVia,
  PcbViaClearanceError,
} from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { EPSILON, getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import { distance } from "lib/util/distance"
import { viasAreAtSameLocation } from "lib/util/viasAreAtSameLocation"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"

export function checkSameNetViaSpacing(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minClearance,
  }: { connMap?: ConnectivityMap; minClearance?: number } = {},
): PcbViaClearanceError[] {
  const vias = circuitJson.filter((el) => el.type === "pcb_via") as PcbVia[]
  if (vias.length < 2) return []
  const board = getPcbBoard(circuitJson)
  minClearance ??=
    getBoardDrcValue(board, "min_via_hole_edge_to_via_hole_edge_clearance") ??
    jlcMinTolerances.min_via_hole_edge_to_via_hole_edge_clearance
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
  const errors: PcbViaClearanceError[] = []
  const reported = new Set<string>()

  for (let i = 0; i < vias.length; i++) {
    for (let j = i + 1; j < vias.length; j++) {
      const viaA = vias[i]
      const viaB = vias[j]
      if (viaA.pcb_via_id === viaB.pcb_via_id) continue
      // TODO: It is a very inefficient piece of code, the way to fix it is to use flatbush.
      if (viasAreAtSameLocation(viaA, viaB)) {
        const sharedLayers = viaA.layers.filter((layer) =>
          viaB.layers.includes(layer),
        )
        const isStackedBlindViaHandoff =
          Boolean(board?.allow_blind_and_buried_vias) &&
          sharedLayers.length <= 1 &&
          (viaA.layers.length !== viaB.layers.length ||
            !viaA.layers.every((layer) => viaB.layers.includes(layer)))
        if (isStackedBlindViaHandoff) continue
      }
      if (!connMap.areIdsConnected(viaA.pcb_via_id, viaB.pcb_via_id)) continue
      const isConcentricDuplicate = viasAreAtSameLocation(viaA, viaB)
      const gap =
        distance(viaA, viaB) - viaA.hole_diameter / 2 - viaB.hole_diameter / 2
      if (!isConcentricDuplicate && gap + EPSILON >= minClearance!) continue
      const pairId = [viaA.pcb_via_id, viaB.pcb_via_id].sort().join("_")
      if (reported.has(pairId)) continue
      reported.add(pairId)
      errors.push({
        type: "pcb_via_clearance_error",
        pcb_error_id: `same_net_vias_close_${pairId}`,
        message: isConcentricDuplicate
          ? `Vias ${getReadableNameForElement(
              circuitJson,
              viaA.pcb_via_id,
            )} and ${getReadableNameForElement(
              circuitJson,
              viaB.pcb_via_id,
            )} are concentric duplicate vias at (${viaA.x.toFixed(3)}mm, ${viaA.y.toFixed(3)}mm)`
          : `Vias ${getReadableNameForElement(
              circuitJson,
              viaA.pcb_via_id,
            )} and ${getReadableNameForElement(
              circuitJson,
              viaB.pcb_via_id,
            )} are too close together (gap: ${gap.toFixed(3)}mm)`,
        error_type: "pcb_via_clearance_error",
        pcb_via_ids: [viaA.pcb_via_id, viaB.pcb_via_id],
        minimum_clearance: minClearance,
        actual_clearance: isConcentricDuplicate ? 0 : gap,
        pcb_center: {
          x: (viaA.x + viaB.x) / 2,
          y: (viaA.y + viaB.y) / 2,
        },
      })
    }
  }

  return errors
}
