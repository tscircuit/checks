import type {
  AnyCircuitElement,
  PcbTrace,
  PcbTraceTooManyViasWarning,
  SourceTrace,
} from "circuit-json"

/** Return a routing warning when a source trace exceeds its maximum via count. */
export const checkPcbTraceViaCounts = (
  circuitJson: AnyCircuitElement[],
): PcbTraceTooManyViasWarning[] => {
  const sourceTraces = circuitJson.filter(
    (element): element is SourceTrace => element.type === "source_trace",
  )
  const pcbTraces = circuitJson.filter(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )
  const warnings: PcbTraceTooManyViasWarning[] = []

  for (const sourceTrace of sourceTraces) {
    const maximumViaCount = sourceTrace.max_via_count
    if (typeof maximumViaCount !== "number") continue

    const routedPcbTraces = pcbTraces.filter(
      (pcbTrace) => pcbTrace.source_trace_id === sourceTrace.source_trace_id,
    )
    if (routedPcbTraces.length === 0) continue

    const actualViaCount = routedPcbTraces.reduce(
      (viaCount, pcbTrace) =>
        viaCount +
        pcbTrace.route.filter((routePoint) => routePoint.route_type === "via")
          .length,
      0,
    )
    if (actualViaCount <= maximumViaCount) continue

    const pcbTraceContainingVia = routedPcbTraces.find((pcbTrace) =>
      pcbTrace.route.some((routePoint) => routePoint.route_type === "via"),
    )
    if (!pcbTraceContainingVia) continue

    warnings.push({
      type: "pcb_trace_too_many_vias_warning",
      pcb_trace_too_many_vias_warning_id: `pcb_trace_too_many_vias_warning_${sourceTrace.source_trace_id}`,
      warning_type: "pcb_trace_too_many_vias_warning",
      message: `PCB trace uses ${actualViaCount} vias, exceeding the ${maximumViaCount} maximum`,
      pcb_trace_id: pcbTraceContainingVia.pcb_trace_id,
      source_trace_id: sourceTrace.source_trace_id,
      source_net_id: sourceTrace.connected_source_net_ids[0],
      actual_via_count: actualViaCount,
      maximum_via_count: maximumViaCount,
      subcircuit_id:
        pcbTraceContainingVia.subcircuit_id ?? sourceTrace.subcircuit_id,
    })
  }

  return warnings
}
