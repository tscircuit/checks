import {
  getPrimaryId,
  getReadableNameForElement,
} from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, PcbPadPadClearanceError } from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { SpatialObjectIndex } from "lib/data-structures/SpatialIndex"
import { DEFAULT_PAD_PAD_CLEARANCE, EPSILON } from "lib/drc-defaults"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import {
  type PadElement,
  formatMm,
  getPadBounds,
  getPadCenter,
  getPadToPadGap,
  getPads,
} from "./check-pad-clearance/common"

export function checkPadPadClearance(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minClearance = DEFAULT_PAD_PAD_CLEARANCE,
  }: { connMap?: ConnectivityMap; minClearance?: number } = {},
): PcbPadPadClearanceError[] {
  const pads = getPads(circuitJson)
  if (pads.length < 2) return []

  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
  const spatialIndex = new SpatialObjectIndex<PadElement>({
    objects: pads,
    getBounds: getPadBounds,
    getId: (pad) => getPrimaryId(pad),
  })

  const errors = new Map<string, PcbPadPadClearanceError>()

  for (const padA of pads) {
    const padAId = getPrimaryId(padA)
    const nearbyPads = spatialIndex.getObjectsInBounds(
      getPadBounds(padA),
      minClearance,
    )

    for (const padB of nearbyPads) {
      const padBId = getPrimaryId(padB)
      if (padAId === padBId) continue
      if (
        !getLayersOfPcbElement(padA as any).some((layer) =>
          getLayersOfPcbElement(padB as any).includes(layer),
        )
      ) {
        continue
      }
      if (connMap.areIdsConnected(padAId, padBId)) continue

      const pairId = [padAId, padBId].sort().join("_")
      const gap = getPadToPadGap(padA, padB)
      if (gap + EPSILON >= minClearance!) continue
      const centerA = getPadCenter(padA)
      const centerB = getPadCenter(padB)

      const nextError: PcbPadPadClearanceError = {
        type: "pcb_pad_pad_clearance_error",
        pcb_pad_pad_clearance_error_id: `pad_pad_clearance_${pairId}`,
        error_type: "pcb_pad_pad_clearance_error",
        message: `Pads ${getReadableNameForElement(circuitJson, padAId)} and ${getReadableNameForElement(circuitJson, padBId)} are too close (clearance: ${formatMm(gap)}, minimum: ${formatMm(minClearance!)})`,
        pcb_pad_ids: [padAId, padBId] as [string, string],
        minimum_clearance: minClearance,
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
