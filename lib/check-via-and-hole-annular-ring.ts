import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  PcbPlacementError,
  PcbPlatedHole,
  PcbTrace,
  PcbVia,
} from "circuit-json"
import { getBoardDrcValue, getPcbBoard } from "./drc-defaults"

export interface ViaAndHoleAnnularRingCheckConfig {
  minViaHoleDiameter?: number
  minViaPadDiameter?: number
  minViaAnnularRing?: number
  minPlatedHoleAnnularRing?: number
}

const EPSILON = 1e-6
const DEFAULT_MIN_PLATED_HOLE_ANNULAR_RING = 0.15

/**
 * Checks vias and plated holes against board minimum hole/pad dimensions and annular ring limits.
 */
export function checkViaAndHoleAnnularRing(
  circuitJson: AnyCircuitElement[],
  config: ViaAndHoleAnnularRingCheckConfig = {},
): PcbPlacementError[] {
  const errors: PcbPlacementError[] = []
  const board = getPcbBoard(circuitJson)

  const minViaHoleDiameter =
    config.minViaHoleDiameter ??
    getBoardDrcValue(board, "min_via_hole_diameter") ??
    jlcMinTolerances.min_via_hole_diameter ??
    0.2

  const minViaPadDiameter =
    config.minViaPadDiameter ??
    getBoardDrcValue(board, "min_via_pad_diameter") ??
    jlcMinTolerances.min_via_pad_diameter ??
    0.3

  const minViaAnnularRing =
    config.minViaAnnularRing ??
    Math.max(0, (minViaPadDiameter - minViaHoleDiameter) / 2)

  const minPlatedHoleAnnularRing =
    config.minPlatedHoleAnnularRing ?? DEFAULT_MIN_PLATED_HOLE_ANNULAR_RING

  // 1. Check explicit PCB vias
  const vias = circuitJson.filter((el): el is PcbVia => el.type === "pcb_via")
  for (const via of vias) {
    if (via.hole_diameter < minViaHoleDiameter - EPSILON) {
      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `via_hole_below_min_${via.pcb_via_id}`,
        error_type: "pcb_placement_error",
        message: `Via hole diameter ${via.hole_diameter}mm is below the board minimum (${minViaHoleDiameter}mm) for via ${via.pcb_via_id}`,
        subcircuit_id: via.subcircuit_id,
      })
    }

    if (via.outer_diameter < minViaPadDiameter - EPSILON) {
      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `via_pad_below_min_${via.pcb_via_id}`,
        error_type: "pcb_placement_error",
        message: `Via pad diameter ${via.outer_diameter}mm is below the board minimum (${minViaPadDiameter}mm) for via ${via.pcb_via_id}`,
        subcircuit_id: via.subcircuit_id,
      })
    }

    const ring = (via.outer_diameter - via.hole_diameter) / 2
    if (via.outer_diameter <= via.hole_diameter + EPSILON) {
      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `via_annular_ring_invalid_${via.pcb_via_id}`,
        error_type: "pcb_placement_error",
        message: `Via pad diameter (${via.outer_diameter}mm) must be greater than hole diameter (${via.hole_diameter}mm) for via ${via.pcb_via_id}`,
        subcircuit_id: via.subcircuit_id,
      })
    } else if (ring < minViaAnnularRing - EPSILON) {
      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `via_annular_ring_below_min_${via.pcb_via_id}`,
        error_type: "pcb_placement_error",
        message: `Via annular ring ${ring.toFixed(3)}mm is below the minimum (${minViaAnnularRing}mm) for via ${via.pcb_via_id}`,
        subcircuit_id: via.subcircuit_id,
      })
    }
  }

  // 2. Check route-point vias in PCB traces
  const traces = circuitJson.filter(
    (el): el is PcbTrace => el.type === "pcb_trace",
  )
  for (const trace of traces) {
    if (!trace.route) continue
    for (let i = 0; i < trace.route.length; i++) {
      const pt = trace.route[i]
      if (
        pt.route_type === "via" &&
        typeof pt.hole_diameter === "number" &&
        typeof pt.outer_diameter === "number"
      ) {
        const ptId = `${trace.pcb_trace_id}_via_${i}`
        if (pt.hole_diameter < minViaHoleDiameter - EPSILON) {
          errors.push({
            type: "pcb_placement_error",
            pcb_placement_error_id: `trace_via_hole_below_min_${ptId}`,
            error_type: "pcb_placement_error",
            message: `Via hole diameter ${pt.hole_diameter}mm in trace ${trace.pcb_trace_id} is below the board minimum (${minViaHoleDiameter}mm)`,
            subcircuit_id: trace.subcircuit_id,
          })
        }

        if (pt.outer_diameter < minViaPadDiameter - EPSILON) {
          errors.push({
            type: "pcb_placement_error",
            pcb_placement_error_id: `trace_via_pad_below_min_${ptId}`,
            error_type: "pcb_placement_error",
            message: `Via pad diameter ${pt.outer_diameter}mm in trace ${trace.pcb_trace_id} is below the board minimum (${minViaPadDiameter}mm)`,
            subcircuit_id: trace.subcircuit_id,
          })
        }

        const ring = (pt.outer_diameter - pt.hole_diameter) / 2
        if (pt.outer_diameter <= pt.hole_diameter + EPSILON) {
          errors.push({
            type: "pcb_placement_error",
            pcb_placement_error_id: `trace_via_annular_ring_invalid_${ptId}`,
            error_type: "pcb_placement_error",
            message: `Via pad diameter (${pt.outer_diameter}mm) must be greater than hole diameter (${pt.hole_diameter}mm) in trace ${trace.pcb_trace_id}`,
            subcircuit_id: trace.subcircuit_id,
          })
        } else if (ring < minViaAnnularRing - EPSILON) {
          errors.push({
            type: "pcb_placement_error",
            pcb_placement_error_id: `trace_via_annular_ring_below_min_${ptId}`,
            error_type: "pcb_placement_error",
            message: `Via annular ring ${ring.toFixed(3)}mm in trace ${trace.pcb_trace_id} is below the minimum (${minViaAnnularRing}mm)`,
            subcircuit_id: trace.subcircuit_id,
          })
        }
      }
    }
  }

  // 3. Check plated through holes
  const platedHoles = circuitJson.filter(
    (el): el is PcbPlatedHole => el.type === "pcb_plated_hole",
  )
  for (const hole of platedHoles) {
    let annularRing: number | null = null
    let hasInvalidDimensions = false

    if (hole.shape === "circle") {
      if (hole.outer_diameter <= hole.hole_diameter + EPSILON) {
        hasInvalidDimensions = true
      } else {
        annularRing = (hole.outer_diameter - hole.hole_diameter) / 2
      }
    } else if (hole.shape === "oval" || hole.shape === "pill") {
      if (
        hole.outer_width <= hole.hole_width + EPSILON ||
        hole.outer_height <= hole.hole_height + EPSILON
      ) {
        hasInvalidDimensions = true
      } else {
        annularRing = Math.min(
          (hole.outer_width - hole.hole_width) / 2,
          (hole.outer_height - hole.hole_height) / 2,
        )
      }
    } else if (hole.shape === "circular_hole_with_rect_pad") {
      if (
        hole.rect_pad_width <= hole.hole_diameter + EPSILON ||
        hole.rect_pad_height <= hole.hole_diameter + EPSILON
      ) {
        hasInvalidDimensions = true
      } else {
        annularRing = Math.min(
          (hole.rect_pad_width - hole.hole_diameter) / 2,
          (hole.rect_pad_height - hole.hole_diameter) / 2,
        )
      }
    } else if (
      hole.shape === "pill_hole_with_rect_pad" ||
      hole.shape === "rotated_pill_hole_with_rect_pad"
    ) {
      if (
        hole.rect_pad_width <= hole.hole_width + EPSILON ||
        hole.rect_pad_height <= hole.hole_height + EPSILON
      ) {
        hasInvalidDimensions = true
      } else {
        annularRing = Math.min(
          (hole.rect_pad_width - hole.hole_width) / 2,
          (hole.rect_pad_height - hole.hole_height) / 2,
        )
      }
    }

    if (hasInvalidDimensions) {
      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `plated_hole_annular_ring_invalid_${hole.pcb_plated_hole_id}`,
        error_type: "pcb_placement_error",
        message: `Plated hole pad outer dimensions must be greater than hole dimensions for plated hole ${hole.pcb_plated_hole_id}`,
        subcircuit_id: hole.subcircuit_id,
      })
    } else if (
      annularRing !== null &&
      annularRing < minPlatedHoleAnnularRing - EPSILON
    ) {
      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `plated_hole_annular_ring_below_min_${hole.pcb_plated_hole_id}`,
        error_type: "pcb_placement_error",
        message: `Plated hole annular ring ${annularRing.toFixed(3)}mm is below the minimum (${minPlatedHoleAnnularRing}mm) for plated hole ${hole.pcb_plated_hole_id}`,
        subcircuit_id: hole.subcircuit_id,
      })
    }
  }

  return errors
}
