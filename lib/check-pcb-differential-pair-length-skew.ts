import type {
  AnyCircuitElement,
  PcbAutoroutingError,
  PcbTrace,
} from "circuit-json"
import { getReadableNameForElementId } from "./util/get-readable-names"
import { measureRoute } from "./util/measure-route"
import type {
  PcbBusLengthSkewErrorWithLaneLengths,
  SourceDifferentialPairBus,
} from "./util/differential-pair-types"

// Expand routed pad traversal into planar copper and a zero-length layer change.
// This is pair-only: ordinary bus measurement keeps its existing behavior.
function expandThroughPads(trace: PcbTrace): PcbTrace {
  return {
    ...trace,
    route: trace.route.flatMap((point): PcbTrace["route"] => {
      if (point.route_type !== "through_pad") return [point]
      const route: PcbTrace["route"] = [
        {
          route_type: "wire",
          ...point.start,
          layer: point.start_layer,
          width: point.width,
        },
        {
          route_type: "wire",
          ...point.end,
          layer: point.start_layer,
          width: point.width,
        },
      ]
      if (point.start_layer !== point.end_layer) {
        route.push({
          route_type: "via",
          ...point.end,
          from_layer: point.start_layer,
          to_layer: point.end_layer,
        })
      }
      return route
    }),
  }
}

export function checkPcbDifferentialPairLengthSkew(
  bus: SourceDifferentialPairBus,
  circuit: AnyCircuitElement[],
): PcbBusLengthSkewErrorWithLaneLengths | PcbAutoroutingError | undefined {
  const name = getReadableNameForElementId(circuit, bus.source_bus_id)
  const coverageError = (detail: string): PcbAutoroutingError => ({
    type: "pcb_autorouting_error",
    pcb_error_id: `pcb_autorouting_error_${bus.source_bus_id}_coverage`,
    error_type: "pcb_autorouting_error",
    subcircuit_id: bus.subcircuit_id,
    message: `Differential pair ${name}: ${detail}; cannot verify lane length skew`,
  })
  const positive = bus.differential_pair.positive_source_trace_ids
  const negative = bus.differential_pair.negative_source_trace_ids
  if (
    !Array.isArray(positive) ||
    !positive.length ||
    !Array.isArray(negative) ||
    !negative.length
  ) {
    return coverageError("both lanes require ordered source traces")
  }
  const members = [...positive, ...negative]
  if (
    new Set(members).size !== members.length ||
    members.length !== bus.source_trace_ids.length ||
    members.some(
      (id, i) =>
        typeof id !== "string" || !id || id !== bus.source_trace_ids[i],
    ) ||
    !Number.isFinite(bus.max_length_skew) ||
    bus.max_length_skew < 0
  ) {
    return coverageError("invalid lane membership or maximum skew")
  }

  const lengths = new Map<string, number>()
  const pcbTraceIds: string[] = []
  for (const id of members) {
    const source = circuit.find(
      (e) => e.type === "source_trace" && e.source_trace_id === id,
    )
    // Use every explicitly owned piece. Generic trace-length endpoint filtering
    // can discard additional copper and must not hide incomplete pair geometry.
    const traces = circuit.filter(
      (e): e is PcbTrace => e.type === "pcb_trace" && e.source_trace_id === id,
    )
    const measured =
      source?.type === "source_trace"
        ? measureRoute(source, traces.map(expandThroughPads), circuit)
        : undefined
    if (!measured || !Number.isFinite(measured.length)) {
      return coverageError(
        `${getReadableNameForElementId(circuit, id)} lacks complete, unambiguous copper`,
      )
    }
    lengths.set(id, measured.length)
    pcbTraceIds.push(...traces.map((trace) => trace.pcb_trace_id))
  }
  const positiveLength = positive.reduce((sum, id) => sum + lengths.get(id)!, 0)
  const negativeLength = negative.reduce((sum, id) => sum + lengths.get(id)!, 0)
  if (!Number.isFinite(positiveLength) || !Number.isFinite(negativeLength)) {
    return coverageError("lane lengths cannot be measured as finite values")
  }
  const skew = Math.abs(positiveLength - negativeLength)
  if (skew <= bus.max_length_skew + 1e-9) return
  const longer = positiveLength > negativeLength ? "positive" : "negative"
  return {
    type: "pcb_bus_length_skew_error",
    pcb_bus_length_skew_error_id: `pcb_bus_length_skew_error_${bus.source_bus_id}`,
    error_type: "pcb_bus_length_skew_error",
    message: `Differential pair ${name}: ${longer} lane is ${skew.toFixed(3)}mm longer (${positiveLength.toFixed(3)}mm vs ${negativeLength.toFixed(3)}mm); max ${bus.max_length_skew}mm`,
    source_bus_id: bus.source_bus_id,
    source_trace_ids: members,
    pcb_trace_ids: pcbTraceIds,
    actual_length_skew: skew,
    maximum_length_skew: bus.max_length_skew,
    subcircuit_id: bus.subcircuit_id,
    differential_pair_lengths: {
      positive_length: positiveLength,
      negative_length: negativeLength,
    },
  }
}
