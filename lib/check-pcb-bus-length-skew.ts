import { hasSourceBusRoutingConstraints } from "./check-pcb-routing-constraints"
import { getReadableNameForElementId } from "lib/util/get-readable-names"
import type {
  AnyCircuitElement,
  PcbBusLengthSkewError,
  SourceBus,
  SourceTrace,
} from "circuit-json"
import { getPcbTracesBySourceTraceId } from "./check-pcb-trace-lengths"
import { measureRoute } from "./util/measure-route"
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
  const sources = new Map(
    circuitJson
      .filter((e): e is SourceTrace => e.type === "source_trace")
      .map((trace) => [trace.source_trace_id, trace]),
  )
  const planarLengths = new Map<
    SourceTrace["source_trace_id"],
    number | undefined
  >()
  const errors: PcbBusLengthSkewError[] = []
  for (const bus of buses) {
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
      if (!planarLengths.has(id)) {
        const source = sources.get(id)
        planarLengths.set(
          id,
          source && measureRoute(source, traces, circuitJson)?.length,
        )
      }
      return [
        {
          id,
          traces,
          planarLength: planarLengths.get(id),
        },
      ]
    })
    if (members.length < 2) continue
    // Use the same physical path as minLength, maxLength and lengthMatchTo.
    // Preserve legacy totals for inputs which supply only lengths or cannot
    // identify an unambiguous path. Keep one measurement basis per bus.
    const hasPlanarGeometry = members.every(
      (member) => member.planarLength !== undefined,
    )
    const lengths = members.map((member) =>
      hasPlanarGeometry
        ? member.planarLength!
        : member.traces.reduce(
            (sum, trace) => sum + getPcbTraceLength(trace),
            0,
          ),
    )
    const skew = Math.max(...lengths) - Math.min(...lengths)
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
