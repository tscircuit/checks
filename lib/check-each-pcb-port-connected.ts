import type {
  PcbPort,
  PcbTrace,
  SourceTrace,
  AnyCircuitElement,
  PcbTraceError,
} from "circuit-json"
import { addStartAndEndPortIdsIfMissing } from "./add-start-and-end-port-ids-if-missing"
import { getReadableNameForPcbPort } from "@tscircuit/circuit-json-util"

function checkEachPcbPortConnected(soup: AnyCircuitElement[]): PcbTraceError[] {
  addStartAndEndPortIdsIfMissing(soup)
  const pcbPorts: PcbPort[] = soup.filter((item) => item.type === "pcb_port")
  const pcbTraces: PcbTrace[] = soup.filter((item) => item.type === "pcb_trace")
  const sourceTraces: SourceTrace[] = soup.filter(
    (item) => item.type === "source_trace",
  )
  const errors: PcbTraceError[] = []

  for (const port of pcbPorts) {
    const connectedTraces = pcbTraces.filter((trace) =>
      trace.route.some(
        (segment: any) =>
          segment.route_type === "wire" &&
          (segment.start_pcb_port_id === port.pcb_port_id ||
            segment.end_pcb_port_id === port.pcb_port_id),
      ),
    )

    const sourceTrace = sourceTraces.find((trace) =>
      trace.connected_source_port_ids?.includes(port.source_port_id),
    )

    const hasSourceTraceWithConnections =
      sourceTrace && sourceTrace.connected_source_port_ids?.length > 0

    if (connectedTraces.length === 0 && hasSourceTraceWithConnections) {
      errors.push({
        type: "pcb_trace_error",
        message: `pcb_trace_error: PCB port ${getReadableNameForPcbPort(soup, port.pcb_port_id)} is not connected by a PCB trace`,
        source_trace_id: sourceTrace.source_trace_id,
        error_type: "pcb_trace_error",
        pcb_trace_id: "",
        pcb_trace_error_id: "",
        pcb_component_ids: [],
        pcb_port_ids: [port.pcb_port_id],
      })
    }
  }

  return errors
}

export { checkEachPcbPortConnected }
