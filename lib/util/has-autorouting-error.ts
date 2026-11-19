import type { AnyCircuitElement } from "circuit-json"

/**
 * A pcb_autorouting_error already says the board is not fully routed. With
 * includeCascadingErrors: false, checks that would report each unrouted
 * connection use this to avoid restating that one failure per port or trace.
 */
export const hasAutoroutingError = (circuitJson: AnyCircuitElement[]) =>
  circuitJson.some((element) => element.type === "pcb_autorouting_error")
