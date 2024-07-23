import type {
  PCBPort,
  PCBTrace,
  SourceTrace,
  AnySoupElement,
  PCBTraceError,
} from "@tscircuit/soup"

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
}

function checkEachPcbPortConnected(soup: AnySoupElement[]): PCBTraceError[] {
  const pcbPorts: PCBPort[] = soup.filter((item) => item.type === "pcb_port")
  const pcbTraces: PCBTrace[] = soup.filter((item) => item.type === "pcb_trace")
  const sourceTraces: SourceTrace[] = soup.filter(
    (item) => item.type === "source_trace",
  )
  const errors: PCBTraceError[] = []

  // Add start_pcb_port_id and end_pcb_port_id if not present
  pcbTraces.forEach((trace) => {
    trace.route.forEach((segment, index) => {
      if (segment.route_type === "wire") {
        if (!segment.start_pcb_port_id && index === 0) {
          const startPort = pcbPorts.find(
            (port) => distance(port.x, port.y, segment.x, segment.y) < 0.001,
          )
          if (startPort) {
            segment.start_pcb_port_id = startPort.pcb_port_id
          }
        }
        if (!segment.end_pcb_port_id && index === trace.route.length - 1) {
          const endPort = pcbPorts.find(
            (port) => distance(port.x, port.y, segment.x, segment.y) < 0.001,
          )
          if (endPort) {
            segment.end_pcb_port_id = endPort.pcb_port_id
          }
        }
      }
    })
  })

  for (const port of pcbPorts) {
    const connectedTraces = pcbTraces.filter((trace) =>
      trace.route.some(
        (segment) =>
          segment.route_type === "wire" &&
          (segment.start_pcb_port_id === port.pcb_port_id ||
            segment.end_pcb_port_id === port.pcb_port_id),
      ),
    )

    if (connectedTraces.length === 0) {
      const sourceTrace = sourceTraces.find((trace) =>
        trace.connected_source_port_ids.includes(port.source_port_id),
      )

      errors.push({
        type: "pcb_error",
        message: `pcb_trace_error: PCB port ${port.pcb_port_id} is not connected by a PCB trace`,
        source_trace_id: sourceTrace ? sourceTrace.source_trace_id : "",
        error_type: "pcb_trace_error",
        pcb_trace_id: "",
        pcb_error_id: "", // Add appropriate ID generation if necessary
        pcb_component_ids: [],
        pcb_port_ids: [port.pcb_port_id],
      })
    }
  }

  return errors
}

export { checkEachPcbPortConnected }
