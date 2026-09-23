import type { PcbTrace } from "circuit-json"

// Compatibility with circuit-json releases before the optional marker was added.
// Keep the contract local until circuit-json#822 is released.
type PcbTraceWithAntennaMarker = PcbTrace & { is_antenna_trace?: boolean }

/** Only explicitly marked radiating copper has intentional open endpoints. */
export function isAntennaTrace(trace: PcbTrace): boolean {
  return (trace as PcbTraceWithAntennaMarker).is_antenna_trace === true
}
