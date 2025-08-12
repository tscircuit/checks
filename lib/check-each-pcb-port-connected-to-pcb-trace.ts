import type {
  PcbPort,
  PcbTrace,
  SourceTrace,
  AnyCircuitElement,
  PcbPortNotConnectedError,
} from "circuit-json"
import { addStartAndEndPortIdsIfMissing } from "./add-start-and-end-port-ids-if-missing"
import { getReadableNameForPcbPort } from "@tscircuit/circuit-json-util"

function checkEachPcbPortConnectedToPcbTraces(
  circuitJson: AnyCircuitElement[],
): PcbPortNotConnectedError[] {
  addStartAndEndPortIdsIfMissing(circuitJson)
  const pcbPorts: PcbPort[] = circuitJson.filter(
    (item) => item.type === "pcb_port",
  )
  const pcbTraces: PcbTrace[] = circuitJson.filter(
    (item) => item.type === "pcb_trace",
  )
  const sourceTraces: SourceTrace[] = circuitJson.filter(
    (item) => item.type === "source_trace",
  )
  const errors: PcbPortNotConnectedError[] = []

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
        type: "pcb_port_not_connected_error",
        message: `pcb_port_not_connected_error: PCB port ${getReadableNameForPcbPort(circuitJson, port.pcb_port_id)} is not connected by a PCB trace`,
        error_type: "pcb_port_not_connected_error",
        pcb_port_ids: [port.pcb_port_id],
        pcb_component_ids: [port.pcb_component_id],
        pcb_port_not_connected_error_id: `pcb_port_not_connected_error_${port.pcb_port_id}`,
      })
    }
  }

  return errors
}

export { checkEachPcbPortConnectedToPcbTraces }
