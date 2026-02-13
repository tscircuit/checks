import type {
  PcbPort,
  SourceTrace,
  AnyCircuitElement,
  PcbPortNotConnectedError,
} from "circuit-json"
import { addStartAndEndPortIdsIfMissing } from "./add-start-and-end-port-ids-if-missing"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { getReadableNameForPort } from "./util/get-readable-names"

function checkEachPcbPortConnectedToPcbTraces(
  circuitJson: AnyCircuitElement[],
): PcbPortNotConnectedError[] {
  addStartAndEndPortIdsIfMissing(circuitJson)
  const sourceTraces: SourceTrace[] = circuitJson.filter(
    (item) => item.type === "source_trace",
  ) as SourceTrace[]

  const pcbPorts: PcbPort[] = circuitJson.filter(
    (item) => item.type === "pcb_port",
  ) as PcbPort[]

  const errors: PcbPortNotConnectedError[] = []

  // Generate the connectivity map from the circuit
  const connectivityMap = getFullConnectivityMapFromCircuitJson(circuitJson)

  // Create a map from source_port_id to pcb_port for quick lookup
  const sourcePortToPcbPort = new Map<string, PcbPort>()
  for (const pcbPort of pcbPorts) {
    sourcePortToPcbPort.set(pcbPort.source_port_id, pcbPort)
  }

  // Process each source trace
  for (const sourceTrace of sourceTraces) {
    const connectedSourcePortIds = sourceTrace.connected_source_port_ids

    // Skip traces with less than 2 ports (nothing to connect)
    if (connectedSourcePortIds.length < 2) {
      continue
    }

    // Find corresponding PCB ports for all source ports in this trace
    const pcbPortsInTrace: PcbPort[] = []
    const missingPcbPorts: string[] = []

    for (const sourcePortId of connectedSourcePortIds) {
      const pcbPort = sourcePortToPcbPort.get(sourcePortId)
      if (pcbPort) {
        pcbPortsInTrace.push(pcbPort)
      } else {
        missingPcbPorts.push(sourcePortId)
      }
    }

    // Skip if we don't have at least 2 PCB ports to connect
    if (pcbPortsInTrace.length < 2) {
      continue
    }

    // Get the net ID for the first PCB port as reference
    const firstPcbPort = pcbPortsInTrace[0]
    const referenceNetId = connectivityMap.getNetConnectedToId(
      firstPcbPort.pcb_port_id,
    )

    const netElementIds = connectivityMap.getIdsConnectedToNet(referenceNetId!)
    const pcbTraceIds = netElementIds.filter((id) =>
      circuitJson.some(
        (element) =>
          element.type === "pcb_trace" &&
          (("pcb_trace_id" in element && element.pcb_trace_id === id) ||
            ("route_id" in element && element.route_id === id)),
      ),
    )

    if (pcbTraceIds.length === 0) {
      // Check if this is a trivial case (only 2 ports on same component)
      const uniqueComponentIds = new Set(
        pcbPortsInTrace.map((p) => p.pcb_component_id),
      )

      if (uniqueComponentIds.size > 1) {
        // Ports are on different components but no PCB traces connect them
        errors.push({
          type: "pcb_port_not_connected_error",
          message: `Ports [${pcbPortsInTrace.map((p) => getReadableNameForPort(circuitJson, p.pcb_port_id)).join(", ")}] are not connected together through the same net.`,
          error_type: "pcb_port_not_connected_error",
          pcb_port_ids: pcbPortsInTrace.map((p) => p.pcb_port_id),
          pcb_component_ids: pcbPortsInTrace
            .map((p) => p.pcb_component_id)
            .filter((id): id is string => id !== undefined),
          pcb_port_not_connected_error_id: `pcb_port_not_connected_error_trace_${sourceTrace.source_trace_id}`,
        })
      }
    }
  }

  return errors
}

export { checkEachPcbPortConnectedToPcbTraces }
