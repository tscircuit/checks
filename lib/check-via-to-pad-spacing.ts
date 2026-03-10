import type {
  AnyCircuitElement,
  PcbVia,
  PcbSmtPad,
  PcbPlatedHole,
  PcbViaClearanceError,
} from "circuit-json"
import {
  getReadableNameForElement,
  getBoundsOfPcbElements,
} from "@tscircuit/circuit-json-util"
import { DEFAULT_VIA_TO_PAD_MARGIN, EPSILON } from "lib/drc-defaults"

type Pad = PcbSmtPad | PcbPlatedHole

function getPadId(pad: Pad): string {
  if (pad.type === "pcb_smtpad") return pad.pcb_smtpad_id
  return pad.pcb_plated_hole_id
}

/**
 * Compute the edge-to-edge gap between a via and a pad using bounding boxes.
 * Uses getBoundsOfPcbElements to handle all pad shapes generically.
 */
function computeGap(via: PcbVia, pad: Pad): number {
  const padBounds = getBoundsOfPcbElements([pad as AnyCircuitElement])
  const viaRadius = via.outer_diameter / 2

  // Distance from via center to nearest point on pad bounding box
  const nearestX = Math.max(padBounds.minX, Math.min(via.x, padBounds.maxX))
  const nearestY = Math.max(padBounds.minY, Math.min(via.y, padBounds.maxY))
  const dist = Math.hypot(via.x - nearestX, via.y - nearestY)

  return dist - viaRadius
}

export function checkViaToPadSpacing(
  circuitJson: AnyCircuitElement[],
  { minSpacing = DEFAULT_VIA_TO_PAD_MARGIN }: { minSpacing?: number } = {},
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
