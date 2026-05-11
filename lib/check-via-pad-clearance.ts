import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import {
  distanceBetweenCircleAndCircle,
  distanceBetweenCircleAndPolygon,
} from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PcbPadPadClearanceError,
  PcbVia,
} from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { EPSILON, getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import {
  formatMm,
  getPadCenter,
  getPadRadius,
  getPads,
  isCircularPad,
  type PadElement,
} from "./check-pad-clearance/common"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"

const getPadId = (pad: PadElement): string => {
  if ("pcb_smtpad_id" in pad) return pad.pcb_smtpad_id
  if ("pcb_plated_hole_id" in pad) return pad.pcb_plated_hole_id
  return ""
}

const getViaToPadGap = (via: PcbVia, pad: PadElement): number => {
  const viaRadius = via.outer_diameter / 2
  const viaCircle = {
    kind: "circle" as const,
    x: via.x,
    y: via.y,
    radius: viaRadius,
  }

  const padCenter = getPadCenter(pad)
  const padRadius = getPadRadius(pad)

  if (isCircularPad(pad)) {
    return distanceBetweenCircleAndCircle(viaCircle, {
      kind: "circle" as const,
      x: padCenter.x,
      y: padCenter.y,
      radius: padRadius,
    })
  }

  // For rectangular / polygon pads, use circle-to-polygon distance.
  // We approximate using the pad bounding box, which is consistent with
  // how check-pad-clearance handles non-circular pads.
  return distanceBetweenCircleAndPolygon(viaCircle, {
    kind: "polygon" as const,
    points: (() => {
      // Build a bounding-box polygon from the pad center + radius.
      // getPadRadius returns half of the smaller bounding dimension, so this
      // is conservative (tighter than the actual shape).
      const cx = padCenter.x
      const cy = padCenter.y
      const r = padRadius
      return [
        { x: cx - r, y: cy - r },
        { x: cx + r, y: cy - r },
        { x: cx + r, y: cy + r },
        { x: cx - r, y: cy + r },
      ]
    })(),
  })
}

/**
 * Check that vias are not too close to pads on different nets.
 *
 * A via's copper annular ring must maintain minimum clearance from nearby SMT
 * pads and plated holes that belong to a different electrical net. Violating
 * this rule risks short-circuits during soldering or manufacturing.
 *
 * Related issue: https://github.com/tscircuit/checks/issues/44
 */
export function checkViaPadClearance(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minClearance,
  }: { connMap?: ConnectivityMap; minClearance?: number } = {},
): PcbPadPadClearanceError[] {
  const vias = circuitJson.filter((el) => el.type === "pcb_via") as PcbVia[]
  const pads = getPads(circuitJson)

  if (vias.length === 0 || pads.length === 0) return []

  const board = getPcbBoard(circuitJson)
  minClearance ??=
    getBoardDrcValue(board, "min_trace_to_pad_edge_clearance") ??
    jlcMinTolerances.min_trace_to_pad_edge_clearance

  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)

  const errors: PcbPadPadClearanceError[] = []
  const reported = new Set<string>()

  for (const via of vias) {
    for (const pad of pads) {
      const padId = getPadId(pad)
      if (!padId) continue

      // Skip pads electrically connected to this via
      if (connMap.areIdsConnected(via.pcb_via_id, padId)) continue

      // TODO: use flatbush for spatial indexing to avoid O(n*m) loop
      const gap = getViaToPadGap(via, pad)
      if (gap + EPSILON >= minClearance!) continue

      const pairId = [via.pcb_via_id, padId].sort().join("_")
      if (reported.has(pairId)) continue
      reported.add(pairId)

      const padCenter = getPadCenter(pad)

      errors.push({
        type: "pcb_pad_pad_clearance_error",
        pcb_pad_pad_clearance_error_id: `via_pad_clearance_${pairId}`,
        error_type: "pcb_pad_pad_clearance_error",
        message: `Via ${getReadableNameForElement(
          circuitJson,
          via.pcb_via_id,
        )} is too close to pad ${getReadableNameForElement(
          circuitJson,
          padId,
        )} (gap: ${formatMm(gap)}, minimum: ${formatMm(minClearance!)})`,
        pcb_pad_ids: [via.pcb_via_id, padId],
        minimum_clearance: minClearance,
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
