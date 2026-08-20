import type {
  AnyCircuitElement,
  PcbPort,
  PcbTrace,
  PcbTraceError,
  SourceTrace,
} from "circuit-json"

/** Return a routing error when a source trace exceeds its maximum via count. */
export const checkPcbTraceViaCounts = (
  circuitJson: AnyCircuitElement[],
): PcbTraceError[] => {
  const sourceTraces = circuitJson.filter(
    (element): element is SourceTrace => element.type === "source_trace",
  )
  const pcbTraces = circuitJson.filter(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )
  const pcbPorts = circuitJson.filter(
    (element): element is PcbPort => element.type === "pcb_port",
  )
  const errors: PcbTraceError[] = []

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

    const connectedPcbPorts = pcbPorts.filter(
      (pcbPort) =>
        pcbPort.source_port_id !== undefined &&
        sourceTrace.connected_source_port_ids.includes(pcbPort.source_port_id),
    )
    errors.push({
      type: "pcb_trace_error",
      pcb_trace_error_id: `max_via_count_exceeded_${sourceTrace.source_trace_id}`,
      error_type: "pcb_trace_error",
      message: `PCB trace uses ${actualViaCount} vias, exceeding the ${maximumViaCount} maximum`,
      pcb_trace_id: routedPcbTraces[0]!.pcb_trace_id,
      source_trace_id: sourceTrace.source_trace_id,
      pcb_component_ids: [
        ...new Set(
          connectedPcbPorts
            .map((pcbPort) => pcbPort.pcb_component_id)
            .filter(
              (pcbComponentId): pcbComponentId is string =>
                pcbComponentId !== undefined,
            ),
        ),
      ],
      pcb_port_ids: connectedPcbPorts.map((pcbPort) => pcbPort.pcb_port_id),
      subcircuit_id:
        routedPcbTraces[0]!.subcircuit_id ?? sourceTrace.subcircuit_id,
    })
  }

  return errors
}
