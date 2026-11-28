import { getReadableNameForElementId as getReadableNameForElement } from "lib/util/get-readable-names"

import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
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
import { getViaDrillSpanLayers } from "lib/util/get-via-drill-span-layers"

export function checkDifferentNetViaSpacing(
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
  const minCopperClearance =
    getBoardDrcValue(board, "min_pad_edge_to_pad_edge_clearance") ??
    jlcMinTolerances.min_pad_edge_to_pad_edge_clearance!
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
  const drillSpanByVia = new Map<PcbVia, string[]>(
    vias.map((via) => [via, getViaDrillSpanLayers(via, board)]),
  )
  const copperLayersByVia = new Map<PcbVia, string[]>(
    vias.map((via) => {
      const drillSpan = drillSpanByVia.get(via) ?? []
      const hasExplicitDrillSpan =
        via.through_hole === true ||
        Boolean(via.topmost_drill_layer && via.bottommost_drill_layer)
      if (
        hasExplicitDrillSpan &&
        Array.isArray(via.layers) &&
        via.layers.length > 0
      ) {
        return [via, via.layers]
      }
      return [via, drillSpan]
    }),
  )
  const errors: PcbViaClearanceError[] = []
  const reported = new Set<string>()

  for (let i = 0; i < vias.length; i++) {
    for (let j = i + 1; j < vias.length; j++) {
      const viaA = vias[i]
      const viaB = vias[j]
      // TODO: It is a very inefficient piece of code, the way to fix it is to use flatbush.
      if (connMap.areIdsConnected(viaA.pcb_via_id, viaB.pcb_via_id)) continue
      const drillSpanA = drillSpanByVia.get(viaA) ?? []
      const drillSpanB = drillSpanByVia.get(viaB) ?? []
      if (!drillSpanA.some((layer) => drillSpanB.includes(layer))) continue
      const centerDistance = distance(viaA, viaB)
      let gap = centerDistance - viaA.hole_diameter / 2 - viaB.hole_diameter / 2
      let minimumClearance = minClearance!
      if (gap + EPSILON >= minimumClearance) {
        const copperA = copperLayersByVia.get(viaA) ?? []
        const copperB = copperLayersByVia.get(viaB) ?? []
        if (!copperA.some((layer) => copperB.includes(layer))) continue
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
