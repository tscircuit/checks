import {
  getPrimaryId,
  getReadableNameForElement,
} from "@tscircuit/circuit-json-util"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
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
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import { viasAreAtSameLocation } from "lib/util/viasAreAtSameLocation"
import {
  getPadBounds,
  getPadCenter,
  getPadToPadGap,
} from "./check-pad-clearance/common"

export function checkDifferentNetViaPadClearance(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minClearance,
  }: { connMap?: ConnectivityMap; minClearance?: number } = {},
): PcbPadPadClearanceError[] {
  const vias = circuitJson.filter(
    (element): element is PcbVia => element.type === "pcb_via",
  )
  if (vias.length < 2) return []

  const board = getPcbBoard(circuitJson)
  const requiredClearance =
    minClearance ??
    getBoardDrcValue(board, "min_pad_edge_to_pad_edge_clearance") ??
    jlcMinTolerances.min_pad_edge_to_pad_edge_clearance!
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)

  const viaIndex = new SpatialObjectIndex<PcbVia>({
    objects: vias,
    getBounds: getPadBounds,
    getId: getPrimaryId,
  })
  const errors = new Map<string, PcbPadPadClearanceError>()

  for (const viaA of vias) {
    const nearbyVias = viaIndex.getObjectsInBounds(
      getPadBounds(viaA),
      requiredClearance,
    )

    for (const viaB of nearbyVias) {
      if (viaA.pcb_via_id === viaB.pcb_via_id) continue
      if (viasAreAtSameLocation(viaA, viaB)) continue
      if (
        !getLayersOfPcbElement(viaA).some((layer) =>
          getLayersOfPcbElement(viaB).includes(layer),
        )
      ) {
        continue
      }
      if (connMap.areIdsConnected(viaA.pcb_via_id, viaB.pcb_via_id)) continue

      const pairId = [viaA.pcb_via_id, viaB.pcb_via_id].sort().join("_")
      if (errors.has(pairId)) continue
      const gap = getPadToPadGap(viaA, viaB)
      if (gap + EPSILON >= requiredClearance) continue

      const centerA = getPadCenter(viaA)
      const centerB = getPadCenter(viaB)
      errors.set(pairId, {
        type: "pcb_pad_pad_clearance_error",
        pcb_pad_pad_clearance_error_id: `via_via_pad_clearance_${pairId}`,
        error_type: "pcb_pad_pad_clearance_error",
        message: `Via pads ${getReadableNameForElement(circuitJson, viaA.pcb_via_id)} and ${getReadableNameForElement(circuitJson, viaB.pcb_via_id)} from different nets are too close (clearance: ${formatMm(gap)}, minimum: ${formatMm(requiredClearance)})`,
        pcb_pad_ids: [viaA.pcb_via_id, viaB.pcb_via_id],
        minimum_clearance: requiredClearance,
        actual_clearance: gap,
        center: {
          x: (centerA.x + centerB.x) / 2,
          y: (centerA.y + centerB.y) / 2,
        },
      })
    }
  }

  return Array.from(errors.values())
}
