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
import { SpatialObjectIndex } from "lib/data-structures/SpatialIndex"
import { EPSILON, getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import {
  type PadElement,
  formatMm,
  getPadBounds,
  getPadCenter,
  getPadToPadGap,
  getPads,
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

  const board = getPcbBoard(circuitJson)
  const requiredClearance =
    minClearance ??
    getBoardDrcValue(board, "min_pad_edge_to_pad_edge_clearance") ??
    jlcMinTolerances.min_pad_edge_to_pad_edge_clearance!
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)

  const padIndex = new SpatialObjectIndex<PadElement>({
    objects: pads,
    getBounds: getPadBounds,
    getId: getPrimaryId,
  })
  const errors: PcbPadPadClearanceError[] = []

  for (const via of vias) {
    const nearbyPads = padIndex.getObjectsInBounds(
      getPadBounds(via),
      requiredClearance,
    )

    for (const pad of nearbyPads) {
      const padId = getPrimaryId(pad)
      if (
        !getLayersOfPcbElement(via).some((layer) =>
          getLayersOfPcbElement(pad).includes(layer),
        )
      ) {
        continue
      }
      if (connMap.areIdsConnected(via.pcb_via_id, padId)) continue

      const gap = getPadToPadGap(via, pad)
      if (gap + EPSILON >= requiredClearance) continue

      const viaCenter = getPadCenter(via)
      const padCenter = getPadCenter(pad)
      errors.push({
        type: "pcb_pad_pad_clearance_error",
        pcb_pad_pad_clearance_error_id: `via_pad_clearance_${via.pcb_via_id}_${padId}`,
        error_type: "pcb_pad_pad_clearance_error",
        message: `Via ${getReadableNameForElement(circuitJson, via.pcb_via_id)} and pad ${getReadableNameForElement(circuitJson, padId)} are too close (clearance: ${formatMm(gap)}, minimum: ${formatMm(requiredClearance)})`,
        pcb_pad_ids: [via.pcb_via_id, padId],
        minimum_clearance: requiredClearance,
        actual_clearance: gap,
        center: {
          x: (viaCenter.x + padCenter.x) / 2,
          y: (viaCenter.y + padCenter.y) / 2,
        },
      })
    }
  }

  return errors
}
