import type { PcbVia } from "circuit-json"
import {
  type PadElement,
  getTraceObstacleClearance,
} from "../check-pad-clearance/common"

const GEOMETRY_EPSILON_MM = 1e-9

export function doesViaHoleOverlapPad(via: PcbVia, pad: PadElement): boolean {
  // The solder-wicking opening is the drill, not the annular copper ring.
  // Model it as a zero-length segment with the drill's diameter. Partial
  // intrusion counts; external tangency and copper-only contact do not.
  const { gap } = getTraceObstacleClearance(
    {
      x1: via.x,
      y1: via.y,
      x2: via.x,
      y2: via.y,
      thickness: via.hole_diameter,
    },
    pad,
  )
  return gap < -GEOMETRY_EPSILON_MM
}
