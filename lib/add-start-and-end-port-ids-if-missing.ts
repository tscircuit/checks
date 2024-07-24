import type {
  PCBPort,
  PCBTrace,
  SourceTrace,
  AnySoupElement,
  PCBTraceError,
} from "@tscircuit/soup"

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

export const addStartAndEndPortIdsIfMissing = (
  soup: AnySoupElement[],
): void => {
  const pcbPorts: PCBPort[] = soup.filter((item) => item.type === "pcb_port")
  const pcbTraces: PCBTrace[] = soup.filter((item) => item.type === "pcb_trace")

  // Add start_pcb_port_id and end_pcb_port_id if not present
  for (const trace of pcbTraces) {
    for (let index = 0; index < trace.route.length; index++) {
      const segment = trace.route[index]
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
    }
  }
}
