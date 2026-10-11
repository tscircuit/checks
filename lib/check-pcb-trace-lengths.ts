import { measureConstrainedPcbPath } from "./util/measure-constrained-pcb-path"
import type {
  AnyCircuitElement,
  PcbPort,
  PcbTrace,
  PcbTraceTooLongError,
  SourceTrace,
  PcbTraceWarning,
} from "circuit-json"

const getReferencedPcbPortIds = (pcbTrace: PcbTrace): Set<string> => {
  const pcbPortIds = new Set<string>()

  for (const routePoint of pcbTrace.route) {
    if (routePoint.route_type !== "wire") continue
    if (routePoint.start_pcb_port_id) {
      pcbPortIds.add(routePoint.start_pcb_port_id)
    }
    if (routePoint.end_pcb_port_id) {
      pcbPortIds.add(routePoint.end_pcb_port_id)
    }
  }

  return pcbPortIds
}

export const getPcbTracesBySourceTraceId = (
  circuitJson: AnyCircuitElement[],
) => {
  const sourceTraces = circuitJson.filter(
    (element): element is SourceTrace => element.type === "source_trace",
  )
  const pcbTraces = circuitJson.filter(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )
  const pcbPorts = circuitJson.filter(
    (element): element is PcbPort => element.type === "pcb_port",
  )

  const pcbPortIdsBySourcePortId = new Map<string, Set<string>>()
  for (const pcbPort of pcbPorts) {
    if (!pcbPort.source_port_id) continue
    const pcbPortIds =
      pcbPortIdsBySourcePortId.get(pcbPort.source_port_id) ?? new Set<string>()
    pcbPortIds.add(pcbPort.pcb_port_id)
    pcbPortIdsBySourcePortId.set(pcbPort.source_port_id, pcbPortIds)
  }

  const pcbTracesBySourceTraceId = new Map<string, PcbTrace[]>()
  for (const pcbTrace of pcbTraces) {
    if (!pcbTrace.source_trace_id) continue
    const matchingPcbTraces =
      pcbTracesBySourceTraceId.get(pcbTrace.source_trace_id) ?? []
    matchingPcbTraces.push(pcbTrace)
    pcbTracesBySourceTraceId.set(pcbTrace.source_trace_id, matchingPcbTraces)
  }

  const exactEndpointPcbTraceIdsBySourceTraceId = new Map<string, Set<string>>()
  for (const sourceTrace of sourceTraces) {
    if (sourceTrace.connected_source_port_ids.length !== 2) continue

    const endpointPcbPortIds = sourceTrace.connected_source_port_ids.map(
      (sourcePortId) => pcbPortIdsBySourcePortId.get(sourcePortId),
    )
    if (endpointPcbPortIds.some((pcbPortIds) => !pcbPortIds?.size)) continue

    const exactEndpointPcbTraceIds = new Set(
      (pcbTracesBySourceTraceId.get(sourceTrace.source_trace_id) ?? [])
        .filter((pcbTrace) => {
          const referencedPcbPortIds = getReferencedPcbPortIds(pcbTrace)
          return endpointPcbPortIds.every((pcbPortIds) =>
            [...pcbPortIds!].some((pcbPortId) =>
              referencedPcbPortIds.has(pcbPortId),
            ),
          )
        })
        .map((pcbTrace) => pcbTrace.pcb_trace_id),
    )

    // Keep the existing behavior when the route does not expose one PCB trace
    // joining both explicit endpoints (for example through-pad-only routes).
    if (exactEndpointPcbTraceIds.size > 0) {
      exactEndpointPcbTraceIdsBySourceTraceId.set(
        sourceTrace.source_trace_id,
        exactEndpointPcbTraceIds,
      )
    }
  }
  for (const [id, exactIds] of exactEndpointPcbTraceIdsBySourceTraceId) {
    pcbTracesBySourceTraceId.set(
      id,
      pcbTracesBySourceTraceId
        .get(id)!
        .filter((trace) => exactIds.has(trace.pcb_trace_id)),
    )
  }
  return pcbTracesBySourceTraceId
}

export const checkPcbTraceLengths = (
  circuitJson: AnyCircuitElement[],
): PcbTraceTooLongError[] => {
  const sourceTracesById = new Map(
    circuitJson
      .filter((e): e is SourceTrace => e.type === "source_trace")
      .map((e) => [e.source_trace_id, e]),
  )
  const pcbTracesBySourceTraceId = getPcbTracesBySourceTraceId(circuitJson)
  const errors: PcbTraceTooLongError[] = []

  for (const [sourceTraceId, pcbTraces] of pcbTracesBySourceTraceId) {
    const pcbTrace = pcbTraces[0]!
    const sourceTrace = sourceTracesById.get(sourceTraceId)
    if (!sourceTrace) continue

    const maximumTraceLength = sourceTrace.max_length
    if (typeof maximumTraceLength !== "number") continue

    const measurement = measureConstrainedPcbPath(
      circuitJson,
      sourceTrace,
      pcbTraces,
    )
    if (measurement.status === "unavailable") continue
    const actualTraceLength = measurement.length
    if (actualTraceLength <= maximumTraceLength + 1e-9) continue

    errors.push({
      type: "pcb_trace_too_long_error",
      pcb_trace_too_long_error_id: `pcb_trace_too_long_error_${pcbTrace.pcb_trace_id}`,
      error_type: "pcb_trace_too_long_error",
      message: `PCB trace is ${actualTraceLength.toFixed(2)}mm long, exceeding the ${maximumTraceLength}mm maximum`,
      pcb_trace_id: pcbTrace.pcb_trace_id,
      source_trace_id: sourceTrace.source_trace_id,
      source_net_id: sourceTrace.connected_source_net_ids[0],
      actual_trace_length: actualTraceLength,
      maximum_trace_length: maximumTraceLength,
      subcircuit_id: pcbTrace.subcircuit_id ?? sourceTrace.subcircuit_id,
    })
  }

  return errors
}

/** Surface indeterminate local measurements separately from length violations. */
export const checkPcbTraceLengthMeasurementWarnings = (
  circuitJson: AnyCircuitElement[],
): PcbTraceWarning[] => {
  const traces = getPcbTracesBySourceTraceId(circuitJson)
  return circuitJson.flatMap((element) => {
    if (
      element.type !== "source_trace" ||
      element.max_length_constraint?.origin !== "decoupling" ||
      typeof element.max_length !== "number"
    )
      return []
    const pcbTraces = traces.get(element.source_trace_id) ?? []
    const measurement = measureConstrainedPcbPath(
      circuitJson,
      element,
      pcbTraces,
    )
    if (measurement.status !== "unavailable") return []
    return [
      {
        type: "pcb_trace_warning",
        warning_type: "pcb_trace_warning",
        pcb_trace_warning_id: `pcb_trace_length_measurement_${element.source_trace_id}`,
        message: `Cannot measure local decoupling length: ${measurement.reason}. The ${element.max_length}mm constraint remains unresolved.`,
        pcb_trace_id: pcbTraces[0]?.pcb_trace_id ?? "",
        source_trace_id: element.source_trace_id,
        pcb_port_ids: [],
        pcb_component_ids: [],
        subcircuit_id: element.subcircuit_id,
      },
    ]
  })
}
