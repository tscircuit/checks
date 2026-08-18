import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  PcbPadPadClearanceError,
  PcbVia,
  PcbViaClearanceError,
} from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { formatMm } from "format-si-unit"
import { EPSILON, getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import { distance } from "lib/util/distance"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import { viasAreAtSameLocation } from "lib/util/viasAreAtSameLocation"
import { getPadToPadGap } from "./check-pad-clearance/common"

export function checkDifferentNetViaSpacing(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minClearance,
    minPadClearance,
  }: {
    connMap?: ConnectivityMap
    minClearance?: number
    minPadClearance?: number
  } = {},
): (PcbViaClearanceError | PcbPadPadClearanceError)[] {
  const vias = circuitJson.filter((el) => el.type === "pcb_via") as PcbVia[]
  if (vias.length < 2) return []
  const board = getPcbBoard(circuitJson)
  const requiredHoleClearance =
    minClearance ??
    getBoardDrcValue(board, "min_via_hole_edge_to_via_hole_edge_clearance") ??
    jlcMinTolerances.min_via_hole_edge_to_via_hole_edge_clearance!
  const requiredPadClearance =
    minPadClearance ??
    getBoardDrcValue(board, "min_pad_edge_to_pad_edge_clearance") ??
    jlcMinTolerances.min_pad_edge_to_pad_edge_clearance!
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
  const errors: (PcbViaClearanceError | PcbPadPadClearanceError)[] = []

  for (let i = 0; i < vias.length; i++) {
    for (let j = i + 1; j < vias.length; j++) {
      const viaA = vias[i]
      const viaB = vias[j]
      // TODO: It is a very inefficient piece of code, the way to fix it is to use flatbush.
      if (viasAreAtSameLocation(viaA, viaB)) continue
      if (connMap.areIdsConnected(viaA.pcb_via_id, viaB.pcb_via_id)) continue
      const pairId = [viaA.pcb_via_id, viaB.pcb_via_id].sort().join("_")
      const holeGap =
        distance(viaA, viaB) - viaA.hole_diameter / 2 - viaB.hole_diameter / 2
      if (holeGap + EPSILON < requiredHoleClearance) {
        errors.push({
          type: "pcb_via_clearance_error",
          pcb_error_id: `different_net_vias_close_${pairId}`,
          message: `Vias ${getReadableNameForElement(
            circuitJson,
            viaA.pcb_via_id,
          )} and ${getReadableNameForElement(
            circuitJson,
            viaB.pcb_via_id,
          )} from different nets are too close together (gap: ${holeGap.toFixed(
            3,
          )}mm)`,
          error_type: "pcb_via_clearance_error",
          pcb_via_ids: [viaA.pcb_via_id, viaB.pcb_via_id],
          minimum_clearance: requiredHoleClearance,
          actual_clearance: holeGap,
          pcb_center: {
            x: (viaA.x + viaB.x) / 2,
            y: (viaA.y + viaB.y) / 2,
          },
        })
        continue
      }

      if (
        !getLayersOfPcbElement(viaA).some((layer) =>
          getLayersOfPcbElement(viaB).includes(layer),
        )
      ) {
        continue
      }
      const padGap = getPadToPadGap(viaA, viaB)
      if (padGap + EPSILON >= requiredPadClearance) continue
      errors.push({
        type: "pcb_pad_pad_clearance_error",
        pcb_pad_pad_clearance_error_id: `via_via_pad_clearance_${pairId}`,
        error_type: "pcb_pad_pad_clearance_error",
        message: `Via pads ${getReadableNameForElement(circuitJson, viaA.pcb_via_id)} and ${getReadableNameForElement(circuitJson, viaB.pcb_via_id)} from different nets are too close (clearance: ${formatMm(padGap)}, minimum: ${formatMm(requiredPadClearance)})`,
        pcb_pad_ids: [viaA.pcb_via_id, viaB.pcb_via_id],
        minimum_clearance: requiredPadClearance,
        actual_clearance: padGap,
        center: {
          x: (viaA.x + viaB.x) / 2,
          y: (viaA.y + viaB.y) / 2,
        },
      })
    }
  }

  return errors
}
