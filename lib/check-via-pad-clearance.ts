import {
  getPrimaryId,
  getReadableNameForElement,
} from "@tscircuit/circuit-json-util"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type { AnyCircuitElement, PcbVia } from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { EPSILON, getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import {
  type PadElement,
  formatMm,
  getPadBounds,
  getPadCenter,
  getPadRadius,
  getPads,
  isCircularPad,
} from "./check-pad-clearance/common"

/**
 * Error emitted when a via's copper is closer than the allowed clearance to a
 * pad (an SMT pad or a plated hole).
 *
 * `circuit-json` does not (yet) define a dedicated `pcb_via_pad_clearance_error`
 * type, so it is declared locally here. Promoting this type to `circuit-json`
 * would be a natural follow-up.
 */
export interface PcbViaPadClearanceError {
  type: "pcb_via_pad_clearance_error"
  pcb_via_pad_clearance_error_id: string
  error_type: "pcb_via_pad_clearance_error"
  message: string
  pcb_via_id: string
  pcb_pad_id: string
  minimum_clearance: number
  actual_clearance: number
  center: { x: number; y: number }
}

/**
 * Minimum edge-to-edge distance between a via (treated as a circle) and a pad.
 * A negative value means the two overlap.
 */
const getViaToPadGap = (
  via: { x: number; y: number; radius: number },
  pad: PadElement,
): number => {
  if (isCircularPad(pad)) {
    const center = getPadCenter(pad)
    return (
      Math.hypot(via.x - center.x, via.y - center.y) -
      via.radius -
      getPadRadius(pad)
    )
  }

  // Rectangular pad: distance from the via centre to the pad's axis-aligned
  // bounding box, then subtract the via radius. This matches how the existing
  // pad-to-pad check treats rectangular pads.
  const bounds = getPadBounds(pad)
  const dx = Math.max(bounds.minX - via.x, 0, via.x - bounds.maxX)
  const dy = Math.max(bounds.minY - via.y, 0, via.y - bounds.maxY)
  return Math.hypot(dx, dy) - via.radius
}

/**
 * Checks that vias are not placed too close to pads. A via that is connected to
 * the same net as the pad is ignored, since that proximity is intentional.
 */
export function checkViaPadClearance(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minClearance,
  }: { connMap?: ConnectivityMap; minClearance?: number } = {},
): PcbViaPadClearanceError[] {
  const vias = circuitJson.filter((el) => el.type === "pcb_via") as PcbVia[]
  const pads = getPads(circuitJson)
  if (vias.length === 0 || pads.length === 0) return []

  const board = getPcbBoard(circuitJson)
  minClearance ??=
    getBoardDrcValue(board, "min_pad_edge_to_pad_edge_clearance") ??
    jlcMinTolerances.min_pad_edge_to_pad_edge_clearance
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)

  const errors: PcbViaPadClearanceError[] = []

  for (const via of vias) {
    const viaCircle = { x: via.x, y: via.y, radius: via.outer_diameter / 2 }
    const viaLayers = getLayersOfPcbElement(via)

    for (const pad of pads) {
      const padId = getPrimaryId(pad)

      // Only compare elements that share at least one copper layer.
      const padLayers = getLayersOfPcbElement(pad as any)
      if (!viaLayers.some((layer) => padLayers.includes(layer))) continue

      // A via intentionally connected to the pad's net is not a violation.
      if (connMap.areIdsConnected(via.pcb_via_id, padId)) continue

      const gap = getViaToPadGap(viaCircle, pad)
      if (gap + EPSILON >= minClearance!) continue

      const padCenter = getPadCenter(pad)
      errors.push({
        type: "pcb_via_pad_clearance_error",
        pcb_via_pad_clearance_error_id: `via_pad_clearance_${via.pcb_via_id}_${padId}`,
        error_type: "pcb_via_pad_clearance_error",
        message: `Via ${getReadableNameForElement(circuitJson, via.pcb_via_id)} and pad ${getReadableNameForElement(circuitJson, padId)} are too close (clearance: ${formatMm(gap)}, minimum: ${formatMm(minClearance!)})`,
        pcb_via_id: via.pcb_via_id,
        pcb_pad_id: padId,
        minimum_clearance: minClearance!,
        actual_clearance: gap,
        center: {
          x: (via.x + padCenter.x) / 2,
          y: (via.y + padCenter.y) / 2,
        },
      })
    }
  }

  return errors
}
