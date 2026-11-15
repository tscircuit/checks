import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type { AnyCircuitElement, PcbPlacementError, PcbVia } from "circuit-json"
import {
  getHoleGeometries,
  getViaHoleClearance,
} from "./check-hole-clearance/common"
import { SpatialObjectIndex } from "./data-structures/SpatialIndex"
import {
  DEFAULT_VIA_DIAMETER,
  getBoardDrcValue,
  getPcbBoard,
} from "./drc-defaults"
import { getReadableNameForElementId } from "./util/get-readable-names"

export interface PcbViaHoleClearanceError extends PcbPlacementError {
  pcb_via_id: string
  pcb_hole_id: string
  minimum_clearance: number
  actual_clearance: number
  center: { x: number; y: number }
}

/** Checks via copper against physical non-plated holes on every layer. */
export function checkViaHoleClearance(
  circuitJson: AnyCircuitElement[],
  { minClearance }: { minClearance?: number } = {},
): PcbViaHoleClearanceError[] {
  const board = getPcbBoard(circuitJson)
  const required =
    minClearance ??
    getBoardDrcValue(board, "min_trace_to_hole_edge_clearance") ??
    jlcMinTolerances.min_trace_to_hole_edge_clearance!

  if (!Number.isFinite(required) || required < 0) {
    throw new Error("Via-to-hole clearance must be finite and non-negative")
  }

  const vias = circuitJson.filter(
    (element): element is PcbVia => element.type === "pcb_via",
  )
  if (vias.length === 0) return []

  const holes = getHoleGeometries(circuitJson)
  if (holes.length === 0) return []

  const index = new SpatialObjectIndex({
    objects: holes,
    getId: (hole) => hole.elementId,
    getBounds: (hole) => ({
      minX: hole.bounds.xmin,
      minY: hole.bounds.ymin,
      maxX: hole.bounds.xmax,
      maxY: hole.bounds.ymax,
    }),
  })

  const errors = new Map<
    string,
    { gap: number; error: PcbViaHoleClearanceError }
  >()

  for (const via of vias) {
    const viaRadius = (via.outer_diameter ?? DEFAULT_VIA_DIAMETER ?? 0.3) / 2
    const candidates = index.getObjectsInBounds(
      {
        minX: via.x - viaRadius,
        minY: via.y - viaRadius,
        maxX: via.x + viaRadius,
        maxY: via.y + viaRadius,
      },
      required,
    )

    for (const geometry of candidates) {
      const hole = geometry.sourceElement
      if (hole.type !== "pcb_hole") continue

      const { gap, center } = getViaHoleClearance(via, geometry)
      if (gap + 1e-6 >= required) continue

      const pairId = `${via.pcb_via_id}_${hole.pcb_hole_id}`
      if ((errors.get(pairId)?.gap ?? Number.POSITIVE_INFINITY) <= gap) continue

      const viaName = getReadableNameForElementId(circuitJson, via.pcb_via_id)
      const holeName = getReadableNameForElementId(
        circuitJson,
        hole.pcb_hole_id,
      )

      const message =
        gap <= 0
          ? `Via ${viaName} overlaps with pcb_hole "${holeName}" (accidental contact)`
          : `Via ${viaName} is too close to non-plated hole ${holeName} (gap: ${gap.toFixed(6)}mm, required: ${required}mm)`

      errors.set(pairId, {
        gap,
        error: {
          type: "pcb_placement_error",
          error_type: "pcb_placement_error",
          pcb_placement_error_id: `via_hole_clearance_${pairId}`,
          pcb_via_id: via.pcb_via_id,
          pcb_hole_id: hole.pcb_hole_id,
          minimum_clearance: required,
          actual_clearance: gap,
          center,
          message,
        },
      })
    }
  }

  return Array.from(errors.values(), ({ error }) => error)
}
