import type {
  AnyCircuitElement,
  PcbTraceError,
  SourceTrace,
  PcbTrace,
} from "circuit-json"

/**
 * Check that each source_trace which connects source ports has at least one
 * pcb_trace associated with it. If a source_trace has no corresponding
 * pcb_trace, return an error for that source_trace.
 */
function checkSourceTracesHavePcbTraces(
  soup: AnyCircuitElement[],
): PcbTraceError[] {
  const errors: PcbTraceError[] = []
  const sourceTraces = soup.filter(
    (el) => el.type === "source_trace",
  ) as SourceTrace[]
  const pcbTraces = soup.filter((el) => el.type === "pcb_trace") as PcbTrace[]

  for (const sourceTrace of sourceTraces) {
    if (!sourceTrace.connected_source_port_ids?.length) continue
    const hasPcbTrace = pcbTraces.some(
      (pcbTrace) => pcbTrace.source_trace_id === sourceTrace.source_trace_id,
    )
    if (!hasPcbTrace) {
      errors.push({
        type: "pcb_trace_error",
        error_type: "pcb_trace_error",
        message: `Trace [${sourceTrace.display_name ?? sourceTrace.source_trace_id}] has no PCB traces`,
        source_trace_id: sourceTrace.source_trace_id,
        pcb_trace_id: "",
        pcb_trace_error_id: "",
        pcb_component_ids: [],
        pcb_port_ids: [],
      })
    }
  }

  return errors
}

export { checkSourceTracesHavePcbTraces }
