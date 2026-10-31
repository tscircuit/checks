import type {
  AnyCircuitElement,
  PcbHole,
  PcbPlacementError,
  PcbPlatedHole,
  PcbSilkscreenCircle,
  PcbSilkscreenLine,
  PcbSilkscreenPath,
  PcbSilkscreenRect,
  PcbSilkscreenText,
  PcbSmtPad,
  PcbVia,
} from "circuit-json"
import { getBoardDrcValue, getPcbBoard } from "./drc-defaults"
import { getReadableNameForElementId } from "./util/get-readable-names"

export interface SilkscreenClearanceCheckConfig {
  /** Minimum clearance between silkscreen and pads/holes in mm. Defaults to 0 (direct overlap). */
  minClearance?: number
}

interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function doBoundsOverlapWithClearance(
  a: Bounds,
  b: Bounds,
  clearance = 0,
): boolean {
  return (
    a.minX - clearance < b.maxX &&
    a.maxX + clearance > b.minX &&
    a.minY - clearance < b.maxY &&
    a.maxY + clearance > b.minY
  )
}

function getSilkscreenBounds(
  element:
    | PcbSilkscreenText
    | PcbSilkscreenPath
    | PcbSilkscreenLine
    | PcbSilkscreenRect
    | PcbSilkscreenCircle,
): Bounds | null {
  if (element.type === "pcb_silkscreen_text") {
    const text = element.text || ""
    const fontSize = element.font_size || 1
    const width = Math.max(fontSize, text.length * fontSize * 0.6)
    const height = fontSize
    const cx =
      element.anchor_position?.x ??
      (element as any).center?.x ??
      (element as any).x ??
      0
    const cy =
      element.anchor_position?.y ??
      (element as any).center?.y ??
      (element as any).y ??
      0
    return {
      minX: cx - width / 2,
      maxX: cx + width / 2,
      minY: cy - height / 2,
      maxY: cy + height / 2,
    }
  }

  if (element.type === "pcb_silkscreen_path") {
    if (!element.route || element.route.length === 0) return null
    const stroke = element.stroke_width || 0.1
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const pt of element.route) {
      if (pt.x < minX) minX = pt.x
      if (pt.x > maxX) maxX = pt.x
      if (pt.y < minY) minY = pt.y
      if (pt.y > maxY) maxY = pt.y
    }
    return {
      minX: minX - stroke / 2,
      maxX: maxX + stroke / 2,
      minY: minY - stroke / 2,
      maxY: maxY + stroke / 2,
    }
  }

  if (element.type === "pcb_silkscreen_line") {
    const stroke = element.stroke_width || 0.1
    return {
      minX: Math.min(element.x1, element.x2) - stroke / 2,
      maxX: Math.max(element.x1, element.x2) + stroke / 2,
      minY: Math.min(element.y1, element.y2) - stroke / 2,
      maxY: Math.max(element.y1, element.y2) + stroke / 2,
    }
  }

  if (element.type === "pcb_silkscreen_rect") {
    const cx = element.center?.x ?? 0
    const cy = element.center?.y ?? 0
    const w = element.width || 0
    const h = element.height || 0
    return {
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minY: cy - h / 2,
      maxY: cy + h / 2,
    }
  }

  if (element.type === "pcb_silkscreen_circle") {
    const cx = element.center?.x ?? 0
    const cy = element.center?.y ?? 0
    const r = element.radius || 0
    return {
      minX: cx - r,
      maxX: cx + r,
      minY: cy - r,
      maxY: cy + r,
    }
  }

  return null
}

function getPadOrHoleBounds(
  element: PcbSmtPad | PcbPlatedHole | PcbVia | PcbHole,
): Bounds | null {
  if (element.type === "pcb_smtpad") {
    if (element.shape === "circle") {
      const r = element.radius
      return {
        minX: element.x - r,
        maxX: element.x + r,
        minY: element.y - r,
        maxY: element.y + r,
      }
    }
    if (
      element.shape === "rect" ||
      element.shape === "rotated_rect" ||
      element.shape === "pill" ||
      element.shape === "rotated_pill"
    ) {
      const w = element.width
      const h = element.height
      return {
        minX: element.x - w / 2,
        maxX: element.x + w / 2,
        minY: element.y - h / 2,
        maxY: element.y + h / 2,
      }
    }
    if (element.shape === "polygon") {
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const pt of element.points) {
        if (pt.x < minX) minX = pt.x
        if (pt.x > maxX) maxX = pt.x
        if (pt.y < minY) minY = pt.y
        if (pt.y > maxY) maxY = pt.y
      }
      return { minX, maxX, minY, maxY }
    }
    return null
  }

  if (element.type === "pcb_via") {
    const r = (element.outer_diameter || 0.6) / 2
    return {
      minX: element.x - r,
      maxX: element.x + r,
      minY: element.y - r,
      maxY: element.y + r,
    }
  }

  if (element.type === "pcb_plated_hole") {
    if (element.shape === "circle") {
      const r = element.outer_diameter / 2
      return {
        minX: element.x - r,
        maxX: element.x + r,
        minY: element.y - r,
        maxY: element.y + r,
      }
    }
    const w =
      (element as any).outer_width ?? (element as any).rect_pad_width ?? 1
    const h =
      (element as any).outer_height ?? (element as any).rect_pad_height ?? 1
    return {
      minX: element.x - w / 2,
      maxX: element.x + w / 2,
      minY: element.y - h / 2,
      maxY: element.y + h / 2,
    }
  }

  if (element.type === "pcb_hole") {
    if ("hole_diameter" in element) {
      const r = (element.hole_diameter || 1) / 2
      return {
        minX: element.x - r,
        maxX: element.x + r,
        minY: element.y - r,
        maxY: element.y + r,
      }
    }
    const w =
      (("hole_width" in element ? (element as any).hole_width : 1) || 1) / 2
    const h =
      (("hole_height" in element ? (element as any).hole_height : 1) || 1) / 2
    return {
      minX: element.x - w,
      maxX: element.x + w,
      minY: element.y - h,
      maxY: element.y + h,
    }
  }

  return null
}

function getPadLayers(
  element: PcbSmtPad | PcbPlatedHole | PcbVia | PcbHole,
): string[] {
  if (element.type === "pcb_smtpad") {
    return [element.layer]
  }
  if (element.type === "pcb_via") {
    return element.layers || ["top", "bottom"]
  }
  if (element.type === "pcb_plated_hole") {
    return element.layers || ["top", "bottom"]
  }
  if (element.type === "pcb_hole") {
    return ["top", "bottom"]
  }
  return ["top"]
}

/**
 * Checks for silkscreen elements overlapping pads, mask openings, or holes.
 * Legend drawn over pads gets clipped or interferes with soldering during fabrication.
 */
export function checkSilkscreenClearance(
  circuitJson: AnyCircuitElement[],
  config: SilkscreenClearanceCheckConfig = {},
): PcbPlacementError[] {
  const errors: PcbPlacementError[] = []
  const board = getPcbBoard(circuitJson)

  const minClearance =
    config.minClearance ??
    (getBoardDrcValue(board, "min_silkscreen_to_pad_clearance" as any) as
      | number
      | undefined)

  // Only run when minClearance is specified in config or configured on board
  if (minClearance === undefined) return errors

  const silkscreenElements = circuitJson.filter(
    (
      el,
    ): el is
      | PcbSilkscreenText
      | PcbSilkscreenPath
      | PcbSilkscreenLine
      | PcbSilkscreenRect
      | PcbSilkscreenCircle =>
      el.type === "pcb_silkscreen_text" ||
      el.type === "pcb_silkscreen_path" ||
      el.type === "pcb_silkscreen_line" ||
      el.type === "pcb_silkscreen_rect" ||
      el.type === "pcb_silkscreen_circle",
  )

  const padElements = circuitJson.filter(
    (el): el is PcbSmtPad | PcbPlatedHole | PcbVia | PcbHole =>
      el.type === "pcb_smtpad" ||
      el.type === "pcb_plated_hole" ||
      el.type === "pcb_via" ||
      el.type === "pcb_hole",
  )

  if (silkscreenElements.length === 0 || padElements.length === 0) return errors

  for (const silk of silkscreenElements) {
    const silkBounds = getSilkscreenBounds(silk)
    if (!silkBounds) continue
    const silkLayer = (silk as any).layer || "top"
    const silkId =
      (silk as any).pcb_silkscreen_text_id ||
      (silk as any).pcb_silkscreen_path_id ||
      (silk as any).pcb_silkscreen_line_id ||
      (silk as any).pcb_silkscreen_rect_id ||
      (silk as any).pcb_silkscreen_circle_id ||
      "silkscreen"

    for (const pad of padElements) {
      const padLayers = getPadLayers(pad)
      if (!padLayers.includes(silkLayer)) continue

      const padBounds = getPadOrHoleBounds(pad)
      if (!padBounds) continue

      if (doBoundsOverlapWithClearance(silkBounds, padBounds, minClearance)) {
        const padId =
          (pad as any).pcb_smtpad_id ||
          (pad as any).pcb_plated_hole_id ||
          (pad as any).pcb_via_id ||
          (pad as any).pcb_hole_id ||
          "pad"

        errors.push({
          type: "pcb_placement_error",
          pcb_placement_error_id: `silkscreen_over_pad_${silkId}_${padId}`,
          error_type: "pcb_placement_error",
          message: `Silkscreen element ${silkId} overlaps with pad/hole ${padId} on layer ${silkLayer}`,
          subcircuit_id: (silk as any).subcircuit_id ?? pad.subcircuit_id,
        })
      }
    }
  }

  return errors
}
