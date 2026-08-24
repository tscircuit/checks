import type {
  PcbPort,
  SourceTrace,
  AnyCircuitElement,
  PcbPortNotConnectedError,
  SourceNet,
} from "circuit-json"
import { addStartAndEndPortIdsIfMissing } from "./add-start-and-end-port-ids-if-missing"
import {
  getFullConnectivityMapFromCircuitJson,
  PcbConnectivityMap,
} from "circuit-json-to-connectivity-map"
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
  const sourceNets: SourceNet[] = circuitJson.filter(
    (item) => item.type === "source_net",
  ) as SourceNet[]

  const errors: PcbPortNotConnectedError[] = []

  // Generate the connectivity map from the circuit
  const connectivityMap = getFullConnectivityMapFromCircuitJson(circuitJson)
  const pcbConnectivityMap = new PcbConnectivityMap(circuitJson)

  // Create a map from source_port_id to pcb_port for quick lookup
  const sourcePortToPcbPort = new Map<string, PcbPort>()
  for (const pcbPort of pcbPorts) {
    sourcePortToPcbPort.set(pcbPort.source_port_id, pcbPort)
  }

  const sourceNetNameById = new Map(
    sourceNets.map((sourceNet) => [sourceNet.source_net_id, sourceNet.name]),
  )

  // Process each source trace
  for (const sourceTrace of sourceTraces) {
    const connectedSourcePortIds = sourceTrace.connected_source_port_ids

    if (
      connectedSourcePortIds.length === 1 &&
      sourceTrace.connected_source_net_ids.length > 0
    ) {
      const pcbPort = sourcePortToPcbPort.get(connectedSourcePortIds[0])
      if (!pcbPort) continue

      const connectedPcbTraces = pcbConnectivityMap.getAllTracesConnectedToPort(
        pcbPort.pcb_port_id,
      )

      if (connectedPcbTraces.length === 0) {
        const connectedNetNames = sourceTrace.connected_source_net_ids
          .map((sourceNetId) => sourceNetNameById.get(sourceNetId))
          .filter((name): name is string => Boolean(name))
        const netDescription =
          connectedNetNames.length > 0
            ? `net [${connectedNetNames.join(", ")}]`
            : "its connected net"

        errors.push({
          type: "pcb_port_not_connected_error",
          message: `Port [${getReadableNameForPort(circuitJson, pcbPort.pcb_port_id)}] is not connected to ${netDescription} by a PCB trace.`,
          error_type: "pcb_port_not_connected_error",
          pcb_port_ids: [pcbPort.pcb_port_id],
          pcb_component_ids: pcbPort.pcb_component_id
            ? [pcbPort.pcb_component_id]
            : [],
          pcb_port_not_connected_error_id: `pcb_port_not_connected_error_trace_${sourceTrace.source_trace_id}`,
        })
      }

      continue
    }

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
