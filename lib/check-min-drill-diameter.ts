import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, PcbPlacementError } from "circuit-json"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import { EPSILON, getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"

interface DrilledHole {
  id: string
  diameter: number
}

/**
 * Collect every round drilled hole and its drill diameter. Vias, circular
 * plated holes and circular unplated holes are drilled with a round bit, so
 * their hole_diameter is the drill size. Oval, pill and rectangular holes are
 * milled slots governed by a different rule, so they are left out here.
 */
function getDrilledHoles(circuitJson: AnyCircuitElement[]): DrilledHole[] {
  const holes: DrilledHole[] = []
  for (const el of circuitJson) {
    if (el.type === "pcb_via") {
      holes.push({ id: el.pcb_via_id, diameter: el.hole_diameter })
    } else if (el.type === "pcb_plated_hole" && el.shape === "circle") {
      holes.push({ id: el.pcb_plated_hole_id, diameter: el.hole_diameter })
    } else if (el.type === "pcb_hole" && el.hole_shape === "circle") {
      holes.push({ id: el.pcb_hole_id, diameter: el.hole_diameter })
    }
  }
  return holes
}

/**
 * Flag drilled holes whose drill diameter is below the fab minimum.
 *
 * The fab cannot drill a hole smaller than its smallest bit, so a via or plated
 * hole with a tiny drill is unmanufacturable. Every other check reads a
 * clearance or a position, so a hole that is simply too small to drill was
 * never caught and passed DRC clean. The minimum comes from the board's
 * min_via_hole_diameter when set, otherwise the JLCPCB default (0.2mm).
 */
export function checkMinDrillDiameter(
  circuitJson: AnyCircuitElement[],
  { minDrillDiameter }: { minDrillDiameter?: number } = {},
): PcbPlacementError[] {
  const board = getPcbBoard(circuitJson)
  minDrillDiameter ??=
    getBoardDrcValue(board, "min_via_hole_diameter") ??
    jlcMinTolerances.min_via_hole_diameter

  if (minDrillDiameter === undefined) return []

  const errors: PcbPlacementError[] = []

  for (const hole of getDrilledHoles(circuitJson)) {
    if (hole.diameter + EPSILON >= minDrillDiameter) continue
    const name = getReadableNameForElement(circuitJson, hole.id)
    errors.push({
      type: "pcb_placement_error",
      pcb_placement_error_id: `drill_diameter_too_small_${hole.id}`,
      message: `Drill diameter of ${name} is ${hole.diameter}mm, below the minimum drill diameter of ${minDrillDiameter}mm`,
      error_type: "pcb_placement_error",
    })
  }

  return errors
}
