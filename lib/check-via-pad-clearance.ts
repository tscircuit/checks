import { getReadableNameForElementId as getReadableNameForElement } from "lib/util/get-readable-names"
import { getPrimaryId } from "@tscircuit/circuit-json-util"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  PcbPadPadClearanceError,
  PcbVia,
} from "circuit-json"
import { formatMm } from "format-si-unit"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { SpatialObjectIndex } from "lib/data-structures/SpatialIndex"
import { EPSILON, getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import {
  type PadElement,
  getPadBounds,
  getViaPadClearanceCenter,
  getPadToPadGap,
  getPads,
} from "./check-pad-clearance/common"
import {
  type ClearanceMatrix,
  type NetClassClearanceManager,
  type NetClassDefinition,
  createNetClassClearanceManager,
} from "./net-classes"

export function checkViaPadClearance(
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
  clearanceManager ??= createNetClassClearanceManager(circuitJson, {
    connMap,
    minClearance: requiredClearance,
    netClasses,
    clearanceMatrix,
  })

  const padIndex = new SpatialObjectIndex<PadElement>({
    objects: pads,
    getBounds: getPadBounds,
    getId: getPrimaryId,
  })
  const errors: PcbPadPadClearanceError[] = []

  for (const via of vias) {
    const searchRadius = clearanceManager.getMaxClearanceForId(
      via.pcb_via_id,
      requiredClearance,
    )
    const nearbyPads = padIndex.getObjectsInBounds(
      getPadBounds(via),
      searchRadius,
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
      const effectiveClearance = clearanceManager.getRequiredClearance(
        via.pcb_via_id,
        padId,
        requiredClearance,
      )
      if (gap + EPSILON >= effectiveClearance) continue

      errors.push({
        type: "pcb_pad_pad_clearance_error",
        pcb_pad_pad_clearance_error_id: `via_pad_clearance_${via.pcb_via_id}_${padId}`,
        error_type: "pcb_pad_pad_clearance_error",
        message: `Via ${getReadableNameForElement(circuitJson, via.pcb_via_id)} and pad ${getReadableNameForElement(circuitJson, padId)} are too close (clearance: ${formatMm(gap)}, minimum: ${formatMm(effectiveClearance)})`,
        pcb_pad_ids: [via.pcb_via_id, padId],
        minimum_clearance: effectiveClearance,
        actual_clearance: gap,
        center: getViaPadClearanceCenter(via, pad),
      })
    }
  }

  return errors
}
