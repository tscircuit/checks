import type {
  AnyCircuitElement,
  PcbVia,
  PcbSmtPad,
  PcbPlatedHole,
} from "circuit-json"
import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import {
  getFullConnectivityMapFromCircuitJson,
  type ConnectivityMap,
} from "circuit-json-to-connectivity-map"
import { DEFAULT_VIA_TO_PAD_MARGIN, EPSILON } from "lib/drc-defaults"

type Pad = PcbSmtPad | PcbPlatedHole

function getPadId(pad: Pad): string {
  if (pad.type === "pcb_smtpad") return pad.pcb_smtpad_id
  return pad.pcb_plated_hole_id
}

function getPadLayers(pad: Pad): string[] {
  if (pad.type === "pcb_smtpad") return [pad.layer]
  return pad.layers
}

function sharesLayer(via: PcbVia, pad: Pad): boolean {
  const padLayers = getPadLayers(pad)
  return via.layers.some((l) => padLayers.includes(l))
}

/**
 * Compute the edge-to-edge distance between a via (circle) and a pad.
 * For rect pads we use closest-point-on-rect to circle-center distance.
 * For circle / pill pads we use center-to-center minus radii.
 */
function viaTopadGap(via: PcbVia, pad: Pad): number {
  const vr = via.outer_diameter / 2

  if (pad.type === "pcb_plated_hole") {
    if (pad.shape === "circle") {
      const d = Math.hypot(via.x - pad.x, via.y - pad.y)
      return d - vr - pad.outer_diameter / 2
    }
    // oval / pill plated hole
    const hw = (pad as any).outer_width / 2
    const hh = (pad as any).outer_height / 2
    return rectToCircleGap(pad.x, pad.y, hw, hh, via.x, via.y, vr)
  }

  // pcb_smtpad
  if (pad.shape === "circle") {
    const d = Math.hypot(via.x - pad.x, via.y - pad.y)
    return d - vr - pad.radius
  }

  if (pad.shape === "rect" || pad.shape === "rotated_rect") {
    const hw = (pad as any).width / 2
    const hh = (pad as any).height / 2
    return rectToCircleGap(pad.x, pad.y, hw, hh, via.x, via.y, vr)
  }

  if (pad.shape === "pill" || pad.shape === "rotated_pill") {
    // pill is a rounded rect – approximate as rect for clearance
    const hw = (pad as any).width / 2
    const hh = (pad as any).height / 2
    return rectToCircleGap(pad.x, pad.y, hw, hh, via.x, via.y, vr)
  }

  // polygon – fall back to bounding-box center distance
  if (pad.shape === "polygon") {
    const pts: { x: number; y: number }[] = (pad as any).points ?? []
    if (pts.length === 0) return Number.POSITIVE_INFINITY
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
    const maxR = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.y - cy)))
    const d = Math.hypot(via.x - cx, via.y - cy)
    return d - vr - maxR
  }

  return Number.POSITIVE_INFINITY
}

/** Edge-to-edge gap between an axis-aligned rect and a circle */
function rectToCircleGap(
  rx: number,
  ry: number,
  hw: number,
  hh: number,
  cx: number,
  cy: number,
  cr: number,
): number {
  // closest point on rect to circle center
  const closestX = Math.max(rx - hw, Math.min(cx, rx + hw))
  const closestY = Math.max(ry - hh, Math.min(cy, ry + hh))
  const d = Math.hypot(cx - closestX, cy - closestY)
  return d - cr
}

export interface ViaToPadSpacingError {
  type: "pcb_via_clearance_error"
  pcb_error_id: string
  message: string
  error_type: "pcb_via_clearance_error"
  pcb_via_ids: string[]
  minimum_clearance: number
  actual_clearance: number
  pcb_center: { x: number; y: number }
}

export function checkViaToPadSpacing(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minSpacing = DEFAULT_VIA_TO_PAD_MARGIN,
  }: { connMap?: ConnectivityMap; minSpacing?: number } = {},
): ViaToPadSpacingError[] {
  const vias = circuitJson.filter((el) => el.type === "pcb_via") as PcbVia[]
  const pads = circuitJson.filter(
    (el) => el.type === "pcb_smtpad" || el.type === "pcb_plated_hole",
  ) as Pad[]

  if (vias.length === 0 || pads.length === 0) return []

  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)

  const errors: ViaToPadSpacingError[] = []
  const reported = new Set<string>()

  for (const via of vias) {
    for (const pad of pads) {
      if (!sharesLayer(via, pad)) continue

      const viaId = via.pcb_via_id
      const padId = getPadId(pad)

      // Skip if on the same net
      if (connMap.areIdsConnected(viaId, padId)) continue

      const gap = viaTopadGap(via, pad)
      if (gap + EPSILON >= minSpacing) continue

      const pairId = [viaId, padId].sort().join("_")
      if (reported.has(pairId)) continue
      reported.add(pairId)

      errors.push({
        type: "pcb_via_clearance_error",
        pcb_error_id: `via_too_close_to_pad_${pairId}`,
        message: `Via ${getReadableNameForElement(
          circuitJson,
          viaId,
        )} is too close to pad ${getReadableNameForElement(
          circuitJson,
          padId,
        )} (gap: ${gap.toFixed(3)}mm, min: ${minSpacing}mm)`,
        error_type: "pcb_via_clearance_error",
        pcb_via_ids: [viaId],
        minimum_clearance: minSpacing,
        actual_clearance: gap,
        pcb_center: {
          x: (via.x + (pad as any).x) / 2,
          y: (via.y + (pad as any).y) / 2,
        },
      })
    }
  }

  return errors
}
