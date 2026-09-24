import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import { segmentToSegmentMinDistance } from "@tscircuit/math-utils"
import type {
  AnyCircuitElement,
  PcbPadPadClearanceError,
  PcbPlatedHole,
} from "circuit-json"
import { EPSILON, getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"

interface DrillCapsule {
  start: { x: number; y: number }
  end: { x: number; y: number }
  center: { x: number; y: number }
  radius: number
}

const rotate = (x: number, y: number, ccwDegrees: number) => {
  const angle = (ccwDegrees * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}

const toNumber = (value: unknown): number =>
  typeof value === "number" ? value : Number(value) || 0

/**
 * Models a plated hole's DRILL (not its copper pad) as a capsule: a line
 * segment plus a radius. A round drill is a degenerate capsule where start and
 * end are the same point. An oval or pill drill is a segment as long as the
 * elongation, capped by a radius of half the short axis. Returns null for a
 * shape whose drill geometry cannot be determined.
 */
const getDrillCapsule = (ph: PcbPlatedHole): DrillCapsule | null => {
  const offsetX = "hole_offset_x" in ph ? toNumber(ph.hole_offset_x) : 0
  const offsetY = "hole_offset_y" in ph ? toNumber(ph.hole_offset_y) : 0
  const cx = toNumber(ph.x) + offsetX
  const cy = toNumber(ph.y) + offsetY
  const center = { x: cx, y: cy }

  if ("hole_diameter" in ph && typeof ph.hole_diameter === "number") {
    const radius = ph.hole_diameter / 2
    if (radius <= 0) return null
    return { start: center, end: center, center, radius }
  }

  if (
    "hole_width" in ph &&
    "hole_height" in ph &&
    typeof ph.hole_width === "number" &&
    typeof ph.hole_height === "number"
  ) {
    const { hole_width: width, hole_height: height } = ph
    const radius = Math.min(width, height) / 2
    if (radius <= 0) return null
    const halfLine = Math.max(Math.max(width, height) / 2 - radius, 0)
    const ccwRotation =
      "hole_ccw_rotation" in ph && typeof ph.hole_ccw_rotation === "number"
        ? ph.hole_ccw_rotation
        : "ccw_rotation" in ph && typeof ph.ccw_rotation === "number"
          ? ph.ccw_rotation
          : 0
    const axis = width >= height ? { x: halfLine, y: 0 } : { x: 0, y: halfLine }
    const rotated = rotate(axis.x, axis.y, ccwRotation)
    return {
      start: { x: cx - rotated.x, y: cy - rotated.y },
      end: { x: cx + rotated.x, y: cy + rotated.y },
      center,
      radius,
    }
  }

  return null
}

const getDrillGap = (a: DrillCapsule, b: DrillCapsule) =>
  segmentToSegmentMinDistance(a.start, a.end, b.start, b.end) -
  a.radius -
  b.radius

/**
 * Flags pairs of plated holes whose drilled holes sit closer than the minimum
 * drill edge to drill edge clearance. This is a fabrication constraint on the
 * drill step, so it is independent of net: two holes drilled too close cannot
 * be manufactured reliably even when they belong to the same net, the same way
 * checkSameNetViaSpacing enforces via hole spacing regardless of connectivity.
 * Copper pad clearance is handled separately by checkPadPadClearance.
 */
export function checkPlatedHoleDrillClearance(
  circuitJson: AnyCircuitElement[],
  { minClearance }: { minClearance?: number } = {},
): PcbPadPadClearanceError[] {
  const platedHoles = circuitJson.filter(
    (el): el is PcbPlatedHole => el.type === "pcb_plated_hole",
  )
  if (platedHoles.length < 2) return []

  const board = getPcbBoard(circuitJson)
  minClearance ??=
    getBoardDrcValue(
      board,
      "min_plated_hole_drill_edge_to_drill_edge_clearance",
    ) ?? jlcMinTolerances.min_plated_hole_drill_edge_to_drill_edge_clearance

  const holes = platedHoles.map((ph) => ({
    ph,
    capsule: getDrillCapsule(ph),
  }))

  const errors: PcbPadPadClearanceError[] = []
  const reported = new Set<string>()

  for (let i = 0; i < holes.length; i++) {
    for (let j = i + 1; j < holes.length; j++) {
      const a = holes[i]
      const b = holes[j]
      if (!a.capsule || !b.capsule) continue
      // Two holes at the same location are a placement duplicate, not a
      // spacing defect, so skip them the way the via spacing checks do.
      const centerDistance = Math.hypot(
        a.capsule.center.x - b.capsule.center.x,
        a.capsule.center.y - b.capsule.center.y,
      )
      if (centerDistance <= EPSILON) continue
      const gap = getDrillGap(a.capsule, b.capsule)
      if (gap + EPSILON >= minClearance!) continue

      const idA = a.ph.pcb_plated_hole_id
      const idB = b.ph.pcb_plated_hole_id
      const pairId = [idA, idB].sort().join("_")
      if (reported.has(pairId)) continue
      reported.add(pairId)

      errors.push({
        type: "pcb_pad_pad_clearance_error",
        pcb_pad_pad_clearance_error_id: `plated_hole_drill_clearance_${pairId}`,
        error_type: "pcb_pad_pad_clearance_error",
        message: `Plated holes ${getReadableNameForElement(
          circuitJson,
          idA,
        )} and ${getReadableNameForElement(
          circuitJson,
          idB,
        )} have drill holes spaced too closely (gap: ${gap.toFixed(
          3,
        )}mm, minimum: ${minClearance!.toFixed(3)}mm)`,
        pcb_pad_ids: [idA, idB],
        minimum_clearance: minClearance,
        actual_clearance: gap,
        center: {
          x: (a.capsule.center.x + b.capsule.center.x) / 2,
          y: (a.capsule.center.y + b.capsule.center.y) / 2,
        },
      })
    }
  }

  return errors
}
