import type { AnyCircuitElement, PcbTraceError } from "circuit-json"
import { addStartAndEndPortIdsIfMissing } from "./add-start-and-end-port-ids-if-missing"

export function checkEachPcbTraceConnected(
  soup: AnyCircuitElement[],
): PcbTraceError[] {
  addStartAndEndPortIdsIfMissing(soup)
  const pcbTraces = soup.filter((item) => item.type === "pcb_trace")
  const errors: PcbTraceError[] = []

  for (const trace of pcbTraces) {
    const startConnected = trace.route.some(
      (segment: any) =>
        segment.route_type === "wire" && segment.start_pcb_port_id != null,
    )
    const endConnected = trace.route.some(
      (segment: any) =>
        segment.route_type === "wire" && segment.end_pcb_port_id != null,
    )

    if (!startConnected || !endConnected) {
      errors.push({
        type: "pcb_trace_error",
        message: `pcb_trace_error: PCB trace ${trace.pcb_trace_id} is not connected at ${startConnected ? "end" : "start"} or both ends.`,
        source_trace_id: "",
        error_type: "pcb_trace_error",
        pcb_trace_id: trace.pcb_trace_id,
        pcb_trace_error_id: "",
        pcb_component_ids: [],
        pcb_port_ids: [],
      })
    }
  }

  return errors
}
