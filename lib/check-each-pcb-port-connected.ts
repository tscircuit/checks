import type {
  PCBPort,
  PCBTrace,
  SourceTrace,
  AnySoupElement,
  PCBTraceError,
} from "@tscircuit/soup"

function checkEachPcbPortConnected(soup: AnySoupElement[]): PCBTraceError[] {
  const pcbPorts: PCBPort[] = soup.filter((item) => item.type === "pcb_port")
  const pcbTraces: PCBTrace[] = soup.filter((item) => item.type === "pcb_trace")
  const sourceTraces: SourceTrace[] = soup.filter(
    (item) => item.type === "source_trace"
  )

  for (const port of pcbPorts) {
    const connectedTraces = pcbTraces.filter((trace) =>
      trace.route.some(
        (segment) =>
          segment.route_type === "wire" &&
          (segment.start_pcb_port_id === port.pcb_port_id ||
            segment.end_pcb_port_id === port.pcb_port_id)
      )
    )

    if (connectedTraces.length === 0) {
      const sourceTrace = sourceTraces.find((trace) =>
        trace.connected_source_port_ids.includes(port.source_port_id)
      )

      if (!sourceTrace || sourceTrace.connected_source_port_ids.length === 1) {
        return [
          {
            type: "pcb_error",
            message: `pcb_trace_error: PCB port ${port.pcb_port_id} is not connected to any net or other source ports`,
            source_trace_id: sourceTrace ? sourceTrace.source_trace_id : "",
            error_type: "pcb_trace_error",
            pcb_trace_id: "",
            pcb_error_id: "", // Add appropriate ID generation if necessary
            pcb_component_ids: [],
            pcb_port_ids: [port.pcb_port_id],
          },
        ]
      }
    }
  }

  return []
}

export { checkEachPcbPortConnected }
