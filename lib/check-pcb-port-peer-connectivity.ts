import type {
  PcbPort,
  PcbTrace,
  SourceTrace,
  AnyCircuitElement,
  PcbPortNotConnectedError,
} from "circuit-json"
import { addStartAndEndPortIdsIfMissing } from "./add-start-and-end-port-ids-if-missing"
import { getReadableNameForPcbPort } from "@tscircuit/circuit-json-util"

/**
 * Check PCB port peer connectivity:
 * 1. For each pcb port, determine what other pcb ports it should be connected to (based on source trace)
 * 2. Verify that the port is connected to at least one of those expected peer ports via PCB traces
 */
function checkPcbPortPeerConnectivity(
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

  // Build a map of source_port_id to pcb_port_id for quick lookup
  const sourceToPcbPortMap = new Map<string, string>()
  for (const pcbPort of pcbPorts) {
    sourceToPcbPortMap.set(pcbPort.source_port_id, pcbPort.pcb_port_id)
  }

  for (const port of pcbPorts) {
    // Step 1: Find what other PCB ports this port should be connected to
    const sourceTrace = sourceTraces.find((trace) =>
      trace.connected_source_port_ids?.includes(port.source_port_id),
    )

    // Skip if port is not part of any source trace or source trace has no connections
    if (
      !sourceTrace ||
      !sourceTrace.connected_source_port_ids?.length ||
      sourceTrace.connected_source_port_ids.length <= 1
    ) {
      continue
    }

    // Get the expected peer source port IDs (excluding this port's source port)
    const expectedPeerSourcePortIds =
      sourceTrace.connected_source_port_ids.filter(
        (sourcePortId) => sourcePortId !== port.source_port_id,
      )

    // Convert to expected peer PCB port IDs
    const expectedPeerPcbPortIds = expectedPeerSourcePortIds
      .map((sourcePortId) => sourceToPcbPortMap.get(sourcePortId))
      .filter((pcbPortId): pcbPortId is string => pcbPortId !== undefined)

    if (expectedPeerPcbPortIds.length === 0) {
      continue // No peer PCB ports exist, skip this check
    }

    // Step 2: Check if this port is connected to at least one of the expected peer ports
    const connectedPeerPorts = new Set<string>()

    // Find all PCB traces that connect to this port
    for (const trace of pcbTraces) {
      for (let i = 0; i < trace.route.length; i++) {
        const segment = trace.route[i]
        if (segment.route_type !== "wire") continue

        let isConnectedToThisPort = false
        let connectedPeerPortId: string | undefined

        // Check if this segment connects to our port
        if (segment.start_pcb_port_id === port.pcb_port_id) {
          isConnectedToThisPort = true
          connectedPeerPortId = segment.end_pcb_port_id
        } else if (segment.end_pcb_port_id === port.pcb_port_id) {
          isConnectedToThisPort = true
          connectedPeerPortId = segment.start_pcb_port_id
        }

        // If connected to this port, check if the other end is an expected peer
        if (
          isConnectedToThisPort &&
          connectedPeerPortId &&
          expectedPeerPcbPortIds.includes(connectedPeerPortId)
        ) {
          connectedPeerPorts.add(connectedPeerPortId)
        }

        // Also need to check for multi-segment traces where this port connects to a trace
        // that eventually reaches a peer port through other segments
        if (isConnectedToThisPort) {
          // Traverse the entire trace to see if it eventually connects to a peer port
          const traceConnectedPorts = new Set<string>()
          for (const otherSegment of trace.route) {
            if (otherSegment.route_type === "wire") {
              if (otherSegment.start_pcb_port_id) {
                traceConnectedPorts.add(otherSegment.start_pcb_port_id)
              }
              if (otherSegment.end_pcb_port_id) {
                traceConnectedPorts.add(otherSegment.end_pcb_port_id)
              }
            }
          }

          // Check if any of the expected peer ports are in this trace
          for (const expectedPeerPortId of expectedPeerPcbPortIds) {
            if (traceConnectedPorts.has(expectedPeerPortId)) {
              connectedPeerPorts.add(expectedPeerPortId)
            }
          }
        }
      }
    }

    // If no connection to expected peer ports found, create an error
    if (connectedPeerPorts.size === 0) {
      const expectedPeerNames = expectedPeerPcbPortIds
        .map((portId) => {
          const peerPort = pcbPorts.find((p) => p.pcb_port_id === portId)
          return peerPort
            ? getReadableNameForPcbPort(circuitJson, portId)
            : portId
        })
        .join(", ")

      errors.push({
        type: "pcb_port_not_connected_error",
        message: `pcb_port_not_connected_error: PCB port ${getReadableNameForPcbPort(circuitJson, port.pcb_port_id)} is not connected to any of its expected peer ports [${expectedPeerNames}]`,
        error_type: "pcb_port_not_connected_error",
        pcb_port_ids: [port.pcb_port_id],
        pcb_component_ids: [port.pcb_component_id],
        pcb_port_not_connected_error_id: `pcb_port_not_connected_error_${port.pcb_port_id}`,
      })
    }
  }

  return errors
}

export { checkPcbPortPeerConnectivity }
