import { getTraceObstacleClearance } from "lib/check-pad-clearance/common"
import type { OverlappableElement } from "./doPcbElementsOverlap"

const GEOMETRY_EPSILON_MM = 1e-9

export function canSameNetPadsOverlap(
  elem1: OverlappableElement,
  elem2: OverlappableElement,
): boolean {
  if (elem1.type === "pcb_plated_hole" && elem2.type === "pcb_smtpad") {
    return canSameNetPadsOverlap(elem2, elem1)
  }
  if (elem1.type !== "pcb_smtpad") return false
  if (elem2.type === "pcb_smtpad") return true
  if (elem2.type !== "pcb_plated_hole" || elem2.shape !== "circle") return false

  // Same-net copper may touch, but the test pad must clear the physical drill.
  const { gap } = getTraceObstacleClearance(
    {
      x1: elem2.x,
      y1: elem2.y,
      x2: elem2.x,
      y2: elem2.y,
      thickness: elem2.hole_diameter,
    },
    elem1,
  )
  return gap >= -GEOMETRY_EPSILON_MM
}
