import {
  getPrimaryId,
  getReadableNameForElement,
} from "@tscircuit/circuit-json-util"
import {
  distanceBetweenCircleAndCircle,
  distanceBetweenCircleAndPolygon,
} from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, PcbVia } from "circuit-json"
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
  getCircleShape,
  getPadBounds,
  getPadCenter,
  getPads,
  isCircularPad,
  getPolygonShape,
} from "./check-pad-clearance/common"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"

/**
 * Error emitted when a via is closer to a pad than the allowed clearance.
 *
 * `circuit-json` does not yet define a dedicated `pcb_via_pad_clearance_error`
 * type, so it is declared locally. Promoting it to `circuit-json` would be a
 * natural follow-up.
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
 * Minimum edge-to-edge distance between a via (treated as a circle of
 * outer_diameter) and a pad. Uses `getBoundsOfPcbElements` for the pad
 * so that all pad shapes (circle, rect, pill, rotated_pill, polygon, etc.)
 * are handled correctly - the pad is conservatively approximated as either
 * a circle or an axis-aligned bounding-box polygon.
 */
const getViaToPadGap = (
  via: PcbVia,
  pad: PadElement,
): number => {
  const viaCircle = {
    kind: "circle" as const,
    x: via.x,
    y: via.y,
    radius: via.outer_diameter / 2,
  }

  if (isCircularPad(pad)) {
    return distanceBetweenCircleAndCircle(viaCircle, getCircleShape(pad))
  }

  return distanceBetweenCircleAndPolygon(viaCircle, getPolygonShape(pad))
}

/**
 * Checks that vias are not placed too close to pads (SMT pads and plated
 * holes). A via connected to the same net as the pad is ignored.
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

  const spatialIndex = new SpatialObjectIndex<PadElement>({
    objects: pads,
    getBounds: getPadBounds,
    getId: (pad) => getPrimaryId(pad),
  })

  const errors = new Map<
    string,
    { error: PcbViaPadClearanceError; gap: number }
  >()

  for (const via of vias) {
    const viaLayers = getLayersOfPcbElement(via)
    const viaBounds = {
      minX: via.x - via.outer_diameter / 2,
      minY: via.y - via.outer_diameter / 2,
      maxX: via.x + via.outer_diameter / 2,
      maxY: via.y + via.outer_diameter / 2,
    }
    const nearbyPads = spatialIndex.getObjectsInBounds(
      viaBounds,
      minClearance,
    )

    for (const pad of nearbyPads) {
      const padId = getPrimaryId(pad)

      // Only compare elements that share at least one copper layer.
      const padLayers = getLayersOfPcbElement(pad as any)
      if (!viaLayers.some((layer) => padLayers.includes(layer))) continue

      // A via intentionally connected to the pad's net is not a violation.
      if (connMap.areIdsConnected(via.pcb_via_id, padId)) continue

      const gap = getViaToPadGap(via, pad)
      if (gap + EPSILON >= minClearance!) continue

      const pairId = `${via.pcb_via_id}_${padId}`
      const padCenter = getPadCenter(pad)
      const nextError: PcbViaPadClearanceError = {
        type: "pcb_via_pad_clearance_error",
        pcb_via_pad_clearance_error_id: `via_pad_clearance_${pairId}`,
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
      }

      const current = errors.get(pairId)
      if (!current || gap < current.gap) {
        errors.set(pairId, { error: nextError, gap })
      }
    }
  }

  return Array.from(errors.values()).map(({ error }) => error)
}
