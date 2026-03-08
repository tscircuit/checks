import type {
  AnyCircuitElement,
  PcbVia,
  PcbSmtPad,
  PcbPlatedHole,
  PcbViaClearanceError,
} from "circuit-json"
import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import { DEFAULT_VIA_TO_PAD_MARGIN, EPSILON } from "lib/drc-defaults"

type Pad = PcbSmtPad | PcbPlatedHole

/**
 * Get the effective radius of a pad for clearance calculations.
 * For rectangular pads, returns the half-diagonal (conservative bounding circle).
 * For circular pads/plated holes, returns the actual radius.
 */
function getPadRadius(pad: Pad): number {
  if (pad.type === "pcb_smtpad") {
    if (pad.shape === "circle") return pad.radius
    if (
      pad.shape === "rect" ||
      pad.shape === "rotated_rect" ||
      pad.shape === "pill" ||
      pad.shape === "rotated_pill"
    ) {
      return Math.sqrt(pad.width ** 2 + pad.height ** 2) / 2
    }
    return 0
  }
  if (pad.type === "pcb_plated_hole") {
    if (pad.shape === "circle") return pad.outer_diameter / 2
    if (pad.shape === "oval" || pad.shape === "pill") {
      return Math.max(pad.outer_width, pad.outer_height) / 2
    }
    if (pad.shape === "pill_hole_with_rect_pad") {
      return Math.max(pad.rect_pad_width, pad.rect_pad_height) / 2
    }
    return 0
  }
  return 0
}

function getPadId(pad: Pad): string {
  if (pad.type === "pcb_smtpad") return pad.pcb_smtpad_id
  return pad.pcb_plated_hole_id
}

/**
 * Compute the minimum distance between a via (circle) and a rectangular pad.
 * Returns the edge-to-edge gap (negative if overlapping).
 */
function distanceViaToRectPad(
  via: PcbVia,
  pad: { x: number; y: number; width: number; height: number },
): number {
  const halfW = pad.width / 2
  const halfH = pad.height / 2
  // Nearest point on rectangle to via center
  const nearestX = Math.max(pad.x - halfW, Math.min(via.x, pad.x + halfW))
  const nearestY = Math.max(pad.y - halfH, Math.min(via.y, pad.y + halfH))
  const dist = Math.hypot(via.x - nearestX, via.y - nearestY)
  return dist - via.outer_diameter / 2
}

/**
 * Compute the edge-to-edge gap between a via and a circular pad.
 */
function distanceViaToCirclePad(
  via: PcbVia,
  padX: number,
  padY: number,
  padRadius: number,
): number {
  const dist = Math.hypot(via.x - padX, via.y - padY)
  return dist - via.outer_diameter / 2 - padRadius
}

/**
 * Compute the edge-to-edge gap between a via and any pad type.
 */
function computeGap(via: PcbVia, pad: Pad): number {
  if (pad.type === "pcb_smtpad") {
    if (pad.shape === "circle") {
      return distanceViaToCirclePad(via, pad.x, pad.y, pad.radius)
    }
    if (
      pad.shape === "rect" ||
      pad.shape === "rotated_rect" ||
      pad.shape === "pill" ||
      pad.shape === "rotated_pill"
    ) {
      return distanceViaToRectPad(via, {
        x: pad.x,
        y: pad.y,
        width: pad.width,
        height: pad.height,
      })
    }
    // Fallback: use bounding circle
    return distanceViaToCirclePad(via, pad.x, pad.y, getPadRadius(pad))
  }
  if (pad.type === "pcb_plated_hole") {
    if (pad.shape === "circle") {
      return distanceViaToCirclePad(via, pad.x, pad.y, pad.outer_diameter / 2)
    }
    if (pad.shape === "oval" || pad.shape === "pill") {
      return distanceViaToRectPad(via, {
        x: pad.x,
        y: pad.y,
        width: pad.outer_width,
        height: pad.outer_height,
      })
    }
    if (pad.shape === "pill_hole_with_rect_pad") {
      return distanceViaToRectPad(via, {
        x: pad.x,
        y: pad.y,
        width: pad.rect_pad_width,
        height: pad.rect_pad_height,
      })
    }
    return distanceViaToCirclePad(via, pad.x, pad.y, getPadRadius(pad))
  }
  return Number.POSITIVE_INFINITY
}

export function checkViaToPadSpacing(
  circuitJson: AnyCircuitElement[],
  {
    minSpacing = DEFAULT_VIA_TO_PAD_MARGIN,
  }: { minSpacing?: number } = {},
): PcbViaClearanceError[] {
  const vias = circuitJson.filter((el) => el.type === "pcb_via") as PcbVia[]
  const pads: Pad[] = [
    ...(circuitJson.filter((el) => el.type === "pcb_smtpad") as PcbSmtPad[]),
    ...(circuitJson.filter(
      (el) => el.type === "pcb_plated_hole",
    ) as PcbPlatedHole[]),
  ]

  if (vias.length === 0 || pads.length === 0) return []

  const errors: PcbViaClearanceError[] = []

  for (const via of vias) {
    for (const pad of pads) {
      const gap = computeGap(via, pad)
      if (gap + EPSILON >= minSpacing) continue

      const padId = getPadId(pad)
      const pairId = [via.pcb_via_id, padId].sort().join("_")

      errors.push({
        type: "pcb_via_clearance_error",
        pcb_error_id: `via_pad_close_${pairId}`,
        message: `Via ${getReadableNameForElement(
          circuitJson,
          via.pcb_via_id,
        )} is too close to pad ${getReadableNameForElement(
          circuitJson,
          padId,
        )} (gap: ${gap.toFixed(3)}mm, minimum: ${minSpacing}mm)`,
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
