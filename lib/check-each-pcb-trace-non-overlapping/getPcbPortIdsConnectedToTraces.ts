import type { PcbTrace } from "circuit-json"

export function getPcbPortIdsConnectedToTrace(trace: PcbTrace) {
  const connectedPcbPorts = new Set<string>()
  for (const segment of trace.route) {
    if (segment.route_type === "wire") {
      if (segment.start_pcb_port_id)
        connectedPcbPorts.add(segment.start_pcb_port_id)
      if (segment.end_pcb_port_id)
        connectedPcbPorts.add(segment.end_pcb_port_id)
    }
  }

  return Array.from(connectedPcbPorts)
}

export function getPcbPortIdsConnectedToTraces(traces: PcbTrace[]) {
  const connectedPorts = new Set<string>()
  for (const trace of traces) {
    for (const portId of getPcbPortIdsConnectedToTrace(trace)) {
      connectedPorts.add(portId)
    }
  }
  return Array.from(connectedPorts)
}
