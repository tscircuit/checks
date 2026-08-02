import { getPrimaryId } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, PcbPlacementError, PcbVia } from "circuit-json"
import {
  type PadElement,
  getPadBounds,
  getPads,
} from "./check-pad-clearance/common"
import { isPointInPad } from "./check-traces-are-contiguous/is-point-in-pad"
import { SpatialObjectIndex } from "./data-structures/SpatialIndex"
import { getPcbBoard } from "./drc-defaults"
import { getLayersOfPcbElement } from "./util/getLayersOfPcbElement"
import { getReadableNameForFootprintPad } from "./util/get-readable-names"

export function checkViasInPads(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  const board = getPcbBoard(circuitJson)
  if (
    board &&
    "is_via_in_pad_allowed" in board &&
    board.is_via_in_pad_allowed === true
  ) {
    return []
  }

  const vias = circuitJson.filter(
    (element): element is PcbVia => element.type === "pcb_via",
  )
  const pads = getPads(circuitJson)
  if (vias.length === 0 || pads.length === 0) return []

  const padOrdinals = new Map(
    pads.map((pad, index) => [getPrimaryId(pad), index]),
  )
  const padIndex = new SpatialObjectIndex<PadElement>({
    objects: pads,
    getBounds: getPadBounds,
    getId: getPrimaryId,
  })
  const errors: PcbPlacementError[] = []

  for (const via of vias) {
    const nearbyPads = padIndex.getObjectsInBounds({
      minX: via.x,
      minY: via.y,
      maxX: via.x,
      maxY: via.y,
    })

    for (const pad of nearbyPads) {
      const viaLayers = getLayersOfPcbElement(via)
      const padLayers = getLayersOfPcbElement(pad)
      if (!viaLayers.some((layer) => padLayers.includes(layer))) continue
      if (!isPointInPad(via, pad)) continue

      const padId = getPrimaryId(pad)
      const padOrdinal = padOrdinals.get(padId) ?? 0
      const padName = getReadableNameForFootprintPad(
        circuitJson,
        pad,
        padOrdinal,
      )

      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `via_in_pad_${via.pcb_via_id}_${padId}`,
        error_type: "pcb_placement_error",
        message: `Via at (${via.x.toFixed(2)}mm, ${via.y.toFixed(2)}mm) is inside ${padName}`,
        subcircuit_id: via.subcircuit_id ?? pad.subcircuit_id,
      })
    }
  }

  return errors
}
