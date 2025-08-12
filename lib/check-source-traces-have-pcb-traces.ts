import type {
  AnyCircuitElement,
  PcbTraceMissingError,
  SourceTrace,
  PcbTrace,
  PcbPort,
} from "circuit-json"

/**
 * Check that each source_trace which connects source ports has at least one
 * pcb_trace associated with it. If a source_trace has no corresponding
 * pcb_trace, return an error for that source_trace.
 */
function checkSourceTracesHavePcbTraces(
  circuitJson: AnyCircuitElement[],
): PcbTraceMissingError[] {
  const errors: PcbTraceMissingError[] = []
  const sourceTraces = circuitJson.filter(
    (el) => el.type === "source_trace",
  ) as SourceTrace[]
  const pcbTraces = circuitJson.filter(
    (el) => el.type === "pcb_trace",
  ) as PcbTrace[]

  for (const sourceTrace of sourceTraces) {
    if (!sourceTrace.connected_source_port_ids?.length) continue
    const hasPcbTrace = pcbTraces.some(
      (pcbTrace) => pcbTrace.source_trace_id === sourceTrace.source_trace_id,
    )
    if (!hasPcbTrace) {
      // Get PCB ports connected to this source trace
      const connectedPcbPorts = circuitJson.filter(
        (el) =>
          el.type === "pcb_port" &&
          sourceTrace.connected_source_port_ids.includes(el.source_port_id),
      ) as PcbPort[]

      // Find PCB components that these ports belong to
      const connectedPcbComponentIds = Array.from(
        new Set(connectedPcbPorts.map((port) => port.pcb_component_id)),
      )

      errors.push({
        type: "pcb_trace_missing_error",
        pcb_trace_missing_error_id: `pcb_trace_missing_${sourceTrace.source_trace_id}`,
        error_type: "pcb_trace_missing_error",
        message: `Trace [${sourceTrace.display_name ?? sourceTrace.source_trace_id}] is not connected (it has no PCB trace)`,
        source_trace_id: sourceTrace.source_trace_id,
        pcb_component_ids: connectedPcbComponentIds,
        pcb_port_ids: connectedPcbPorts.map((port) => port.pcb_port_id),
      })
    }
  }

  return errors
}

export { checkSourceTracesHavePcbTraces }
