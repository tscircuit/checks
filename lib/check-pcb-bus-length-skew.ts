import { hasSourceBusRoutingConstraints } from "./check-pcb-routing-constraints"
import { getReadableNameForElementId } from "lib/util/get-readable-names"
import type {
  AnyCircuitElement,
  PcbAutoroutingError,
  SourceBus,
} from "circuit-json"
import { getPcbTracesBySourceTraceId } from "./check-pcb-trace-lengths"
import { getPcbTraceLength } from "./util/get-pcb-trace-length"
import { checkPcbDifferentialPairLengthSkew } from "./check-pcb-differential-pair-length-skew"
import type {
  CircuitJsonWithDifferentialPairs,
  PcbBusLengthSkewErrorWithLaneLengths,
  SourceDifferentialPairBus,
} from "./util/differential-pair-types"

/** Pairs compare complete planar lane sums. Ordinary buses retain their
 * individual member metric and leave unrouted members to connectivity checks. */
export const checkPcbBusLengthSkew = (
  input: CircuitJsonWithDifferentialPairs,
): Array<PcbBusLengthSkewErrorWithLaneLengths | PcbAutoroutingError> => {
  // Legacy helpers do not interpret differential_pair; bridge the old types
  // only here until circuit-json publishes the plural variant.
  const circuitJson = input as AnyCircuitElement[]
  const buses = circuitJson.filter(
    (e): e is SourceBus => e.type === "source_bus",
  )
  const tracesBySource = getPcbTracesBySourceTraceId(circuitJson)
  const errors: Array<
    PcbBusLengthSkewErrorWithLaneLengths | PcbAutoroutingError
  > = []
  for (const bus of buses) {
    if (bus.differential_pair) {
      const error = checkPcbDifferentialPairLengthSkew(
        bus as unknown as SourceDifferentialPairBus,
        circuitJson,
      )
      if (error) errors.push(error)
      continue
    }
    if (
      bus.max_length_skew === undefined ||
      hasSourceBusRoutingConstraints(bus)
    )
      continue
    const members = [...new Set(bus.source_trace_ids)].flatMap((id) => {
      const traces = tracesBySource
        .get(id)
        ?.filter((t) => t.trace_length !== undefined || t.route.length > 1)
      if (!traces?.length) return []
      return [
        {
          id,
          traces,
          length: traces.reduce((sum, t) => sum + getPcbTraceLength(t), 0),
        },
      ]
    })
    if (members.length < 2) continue
    const skew =
      Math.max(...members.map((m) => m.length)) -
      Math.min(...members.map((m) => m.length))
    // Ignore rounding noise at the inclusive boundary.
    if (skew <= bus.max_length_skew + 1e-9) continue
    errors.push({
      type: "pcb_bus_length_skew_error",
      pcb_bus_length_skew_error_id: `pcb_bus_length_skew_error_${bus.source_bus_id}`,
      error_type: "pcb_bus_length_skew_error",
      message: `PCB bus ${getReadableNameForElementId(circuitJson, bus.source_bus_id)} has ${skew.toFixed(2)}mm length skew, exceeding the ${bus.max_length_skew}mm maximum`,
      source_bus_id: bus.source_bus_id,
      source_trace_ids: members.map((m) => m.id),
      pcb_trace_ids: members.flatMap((m) =>
        m.traces.map((t) => t.pcb_trace_id),
      ),
      actual_length_skew: skew,
      maximum_length_skew: bus.max_length_skew,
      subcircuit_id: bus.subcircuit_id,
    })
  }
  return errors
}
