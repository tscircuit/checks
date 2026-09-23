import type { PcbTrace } from "circuit-json"

// Accept the marker while callers upgrade their Circuit JSON version.
interface PcbTraceWithAntennaMarker extends PcbTrace {
  is_antenna_trace?: boolean
}

export function isAntennaTrace(trace: PcbTraceWithAntennaMarker): boolean {
  return trace.is_antenna_trace === true
}
