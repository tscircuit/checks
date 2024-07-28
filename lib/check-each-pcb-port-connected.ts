import type {
  PCBPort,
  PCBTrace,
  SourceTrace,
  AnySoupElement,
  PCBTraceError,
} from "@tscircuit/soup"
import { addStartAndEndPortIdsIfMissing } from "./add-start-and-end-port-ids-if-missing"
import { getReadableNameForPcbPort } from "@tscircuit/soup-util"

function checkEachPcbPortConnected(soup: AnySoupElement[]): PCBTraceError[] {
  addStartAndEndPortIdsIfMissing(soup)
  const pcbPorts: PCBPort[] = soup.filter((item) => item.type === "pcb_port")
  const pcbTraces: PCBTrace[] = soup.filter((item) => item.type === "pcb_trace")
  const sourceTraces: SourceTrace[] = soup.filter(
    (item) => item.type === "source_trace",
  )
  const errors: PCBTraceError[] = []

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

    if (
      connectedTraces.length === 0 &&
      hasSourceTraceWithConnections
    ) {
      errors.push({
        type: "pcb_error",
        message: `pcb_trace_error: PCB port ${getReadableNameForPcbPort(soup, port.pcb_port_id)} is not connected by a PCB trace`,
        source_trace_id: sourceTrace.source_trace_id,
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
