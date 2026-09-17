import type {
  AnyCircuitElement,
  PcbBusLengthSkewError,
  SourceBus,
} from "circuit-json"
import { getPcbTracesBySourceTraceId } from "./check-pcb-trace-lengths"
import { getPcbTraceLength } from "./util/get-pcb-trace-length"

/** Compare total routed lengths of resolved bus members. Unrouted members are
 * left to connectivity checks, never treated as zero-length routes.
 */
export const checkPcbBusLengthSkew = (
  circuitJson: AnyCircuitElement[],
): PcbBusLengthSkewError[] => {
  const buses = circuitJson.filter(
    (e): e is SourceBus => e.type === "source_bus",
  )
  const tracesBySource = getPcbTracesBySourceTraceId(circuitJson)
  const errors: PcbBusLengthSkewError[] = []
  for (const bus of buses) {
    if (bus.max_length_skew === undefined) continue
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
      message: `PCB bus ${bus.name ?? bus.source_bus_id} has ${skew.toFixed(2)}mm length skew, exceeding the ${bus.max_length_skew}mm maximum`,
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
