import type {
  AnyCircuitElement,
  PcbSmtPad,
  PcbVia,
  PcbViaClearanceError,
} from "circuit-json"
import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import { cju } from "@tscircuit/circuit-json-util"
import { DEFAULT_VIA_TO_PAD_MARGIN, EPSILON } from "lib/drc-defaults"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import type { Collidable } from "lib/check-each-pcb-trace-non-overlapping/getCollidableBounds"

/**
 * Compute the minimum edge-to-edge gap between a via (circle) and a pad.
 *
 * Via is treated as a circle with radius = outer_diameter / 2.
 * Pad shapes handled: rect, circle, pill, rotated_rect, rotated_pill.
 * Polygon pads fall back to a bounding-box approximation.
 */
function viaToSmtPadGap(via: PcbVia, pad: PcbSmtPad): number {
  const viaRadius = via.outer_diameter / 2

  if (pad.shape === "circle") {
    const dist = Math.hypot(via.x - pad.x, via.y - pad.y)
    return dist - viaRadius - pad.radius
  }

  if (pad.shape === "rect") {
    return rectToCircleGap(
      pad.x,
      pad.y,
      pad.width,
      pad.height,
      via.x,
      via.y,
      viaRadius,
    )
  }

  if (pad.shape === "rotated_rect") {
    return rotatedRectToCircleGap(
      pad.x,
      pad.y,
      pad.width,
      pad.height,
      pad.ccw_rotation,
      via.x,
      via.y,
      viaRadius,
    )
  }

  if (pad.shape === "pill") {
    // A pill is a rect with semicircular ends. Treat as a rect-to-circle
    // distance, then subtract the pill's corner radius.
    const innerWidth = pad.width - 2 * pad.radius
    const innerHeight = pad.height - 2 * pad.radius
    const gap = rectToCircleGap(
      pad.x,
      pad.y,
      Math.max(innerWidth, 0),
      Math.max(innerHeight, 0),
      via.x,
      via.y,
      viaRadius + pad.radius,
    )
    return gap
  }

  if (pad.shape === "rotated_pill") {
    const innerWidth = pad.width - 2 * pad.radius
    const innerHeight = pad.height - 2 * pad.radius
    const gap = rotatedRectToCircleGap(
      pad.x,
      pad.y,
      Math.max(innerWidth, 0),
      Math.max(innerHeight, 0),
      pad.ccw_rotation,
      via.x,
      via.y,
      viaRadius + pad.radius,
    )
    return gap
  }

  // Polygon — bounding box fallback
  if (pad.shape === "polygon" && pad.points?.length) {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const p of pad.points) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const w = maxX - minX
    const h = maxY - minY
    return rectToCircleGap(cx, cy, w, h, via.x, via.y, viaRadius)
  }

  // Unknown shape — return large gap so no false positive
  return Number.POSITIVE_INFINITY
}

/**
 * Minimum gap between an axis-aligned rectangle (center rx, ry, dimensions w x h)
 * and a circle (center cx, cy, radius cr).
 */
function rectToCircleGap(
  rx: number,
  ry: number,
  w: number,
  h: number,
  cx: number,
  cy: number,
  cr: number,
): number {
  const halfW = w / 2
  const halfH = h / 2
  // Nearest point on rect to circle center
  const nearestX = Math.max(rx - halfW, Math.min(cx, rx + halfW))
  const nearestY = Math.max(ry - halfH, Math.min(cy, ry + halfH))
  const dist = Math.hypot(cx - nearestX, cy - nearestY)
  return dist - cr
}

/**
 * Gap between a rotated rectangle and a circle.
 * We rotate the circle center into the rectangle's local frame, then
 * use the axis-aligned rect-to-circle formula.
 */
function rotatedRectToCircleGap(
  rx: number,
  ry: number,
  w: number,
  h: number,
  ccwRotation: number,
  cx: number,
  cy: number,
  cr: number,
): number {
  // Translate circle center relative to rect center
  const dx = cx - rx
  const dy = cy - ry
  // Rotate into rect-local frame (negate the CCW angle)
  const cos = Math.cos(-ccwRotation)
  const sin = Math.sin(-ccwRotation)
  const localX = dx * cos - dy * sin
  const localY = dx * sin + dy * cos
  return rectToCircleGap(0, 0, w, h, localX, localY, cr)
}

function doLayersOverlap(layersA: string[], layersB: string[]): boolean {
  if (layersA.length === 0 || layersB.length === 0) return true
  return layersA.some((l) => layersB.includes(l))
}

export function checkViaToPadSpacing(
  circuitJson: AnyCircuitElement[],
  { minSpacing = DEFAULT_VIA_TO_PAD_MARGIN }: { minSpacing?: number } = {},
): PcbViaClearanceError[] {
  const vias = circuitJson.filter((el) => el.type === "pcb_via") as PcbVia[]
  const pads = cju(circuitJson).pcb_smtpad.list() as PcbSmtPad[]
  if (vias.length === 0 || pads.length === 0) return []

  const errors: PcbViaClearanceError[] = []
  const reported = new Set<string>()

  for (const via of vias) {
    const viaLayers = getLayersOfPcbElement(via as unknown as Collidable)

    for (const pad of pads) {
      const padLayers = getLayersOfPcbElement(pad as unknown as Collidable)
      if (!doLayersOverlap(viaLayers, padLayers)) continue

      const gap = viaToSmtPadGap(via, pad)
      if (gap + EPSILON >= minSpacing) continue

      const pairId = [via.pcb_via_id, pad.pcb_smtpad_id].sort().join("_")
      if (reported.has(pairId)) continue
      reported.add(pairId)

      const viaName = getReadableNameForElement(circuitJson, via.pcb_via_id)
      const padName = getReadableNameForElement(circuitJson, pad.pcb_smtpad_id)

      errors.push({
        type: "pcb_via_clearance_error",
        pcb_error_id: `via_to_pad_close_${pairId}`,
        message: `Via ${viaName} is too close to pad ${padName} (gap: ${gap.toFixed(3)}mm, min: ${minSpacing}mm)`,
        error_type: "pcb_via_clearance_error",
        pcb_via_ids: [via.pcb_via_id],
        minimum_clearance: minSpacing,
        actual_clearance: gap,
        pcb_center: {
          x: (via.x + pad.x) / 2,
          y: (via.y + pad.y) / 2,
        },
      })
    }
  }

  return errors
}
