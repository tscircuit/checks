import type { AnyCircuitElement } from "circuit-json"

/**
 * Core inserts a pcb_autorouting_error with this id prefix when placement DRC
 * errors make it skip autorouting for a whole subcircuit.
 */
const SKIPPED_FOR_PLACEMENT_ERRORS_PREFIX =
  "pcb_autorouting_skipped_placement_errors_"

/**
 * Subcircuits whose autorouting was skipped outright because of placement
 * errors. Their source traces have no pcb_trace because the router never ran,
 * so connectivity findings for them are derived from the placement problem
 * rather than being independent failures.
 */
export function getSubcircuitIdsWithSkippedAutorouting(
  circuitJson: AnyCircuitElement[],
): Set<string> {
  const subcircuitIds = new Set<string>()
  for (const element of circuitJson) {
    if (element.type !== "pcb_autorouting_error") continue
    const pcbErrorId = (element as any).pcb_error_id
    if (
      typeof pcbErrorId !== "string" ||
      !pcbErrorId.startsWith(SKIPPED_FOR_PLACEMENT_ERRORS_PREFIX)
    ) {
      continue
    }
    const subcircuitId = (element as any).subcircuit_id
    if (typeof subcircuitId === "string") subcircuitIds.add(subcircuitId)
  }
  return subcircuitIds
}
