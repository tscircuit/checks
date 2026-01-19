import type { AnyCircuitElement } from "circuit-json"
import type {
  Collidable,
  PcbTraceSegment,
} from "lib/check-each-pcb-trace-non-overlapping/getCollidableBounds"

/**
 * Element types that can have a subcircuit_id property
 */
export type ElementWithSubcircuitId = AnyCircuitElement & {
  subcircuit_id?: string
}

/**
 * Check if two elements belong to the same board based on their subcircuit_ids.
 * Returns true if either:
 * - Both have the same subcircuit_id
 * - Either element has no subcircuit_id (can't determine, assume same board for compatibility)
 */
export function areElementsOnSameBoard(
  elem1: ElementWithSubcircuitId | PcbTraceSegment,
  elem2: ElementWithSubcircuitId | Collidable,
): boolean {
  const subcircuit1 = elem1.subcircuit_id
  const subcircuit2 = elem2.subcircuit_id

  // If either element has no subcircuit_id, we can't determine board separation
  // Return true to maintain backward compatibility (assumes same board)
  if (!subcircuit1 || !subcircuit2) return true

  return subcircuit1 === subcircuit2
}
