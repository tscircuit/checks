import { PcbConnectivityMap } from "circuit-json-to-connectivity-map/PcbConnectivityMap"
import type {
  AnyCircuitElement,
  PcbPort,
  PcbTrace,
  PcbTraceError,
  SourceNet,
  SourceTrace,
} from "circuit-json"

type PhysicalGroupId = string
type PortsByPhysicalGroupId = Record<PhysicalGroupId, PcbPort[]>

export function checkSourceNetsArePhysicallyConnected(
  circuitJson: AnyCircuitElement[],
): PcbTraceError[] {
  const connectivityMap = new PcbConnectivityMap(circuitJson)
  const pcbPorts = circuitJson.filter(
    (element): element is PcbPort => element.type === "pcb_port",
  )
  const pcbTraces = circuitJson.filter(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )
  const sourceTraces = circuitJson.filter(
    (element): element is SourceTrace => element.type === "source_trace",
  )
  const sourceNets = circuitJson.filter(
    (element): element is SourceNet => element.type === "source_net",
  )
  const errors: PcbTraceError[] = []

  for (const sourceNet of sourceNets) {
    const netSourceTraces = sourceTraces.filter((sourceTrace) =>
      sourceTrace.connected_source_net_ids?.includes(sourceNet.source_net_id),
    )
    const netSourceTraceIds = new Set(
      netSourceTraces.map((sourceTrace) => sourceTrace.source_trace_id),
    )
    const netSourcePortIds = new Set(
      netSourceTraces.flatMap(
        (sourceTrace) => sourceTrace.connected_source_port_ids ?? [],
      ),
    )
    const expectedPorts = pcbPorts.filter((port) =>
      netSourcePortIds.has(port.source_port_id),
    )
    if (expectedPorts.length < 2) continue

    const routedTraces = pcbTraces.filter(
      (trace) =>
        trace.source_trace_id === sourceNet.source_net_id ||
        (trace.source_trace_id !== undefined &&
          netSourceTraceIds.has(trace.source_trace_id)),
    )
    const primaryTrace = routedTraces[0]
    if (!primaryTrace) continue

    const portsByPhysicalGroupId: PortsByPhysicalGroupId = {}
    for (const port of expectedPorts) {
      const groupId = connectivityMap.getConnectivityNetIdForPort(
        port.pcb_port_id,
      )
      if (!groupId) continue
      portsByPhysicalGroupId[groupId] = [
        ...(portsByPhysicalGroupId[groupId] ?? []),
        port,
      ]
    }

    const disconnectedGroups = Object.values(portsByPhysicalGroupId).sort(
      (firstGroup, secondGroup) => secondGroup.length - firstGroup.length,
    )
    if (disconnectedGroups.length < 2) continue
    const errorGroup = disconnectedGroups[1]
    if (!errorGroup) continue

    errors.push({
      type: "pcb_trace_error",
      message: `Net [${sourceNet.name || "unnamed net"}] has ${expectedPorts.length} required PCB ports split across ${disconnectedGroups.length} disconnected copper groups.`,
      source_trace_id: sourceNet.source_net_id,
      error_type: "pcb_trace_error",
      pcb_trace_id: primaryTrace.pcb_trace_id,
      pcb_trace_error_id: `disconnected_copper_groups_${sourceNet.source_net_id}`,
      center: {
        x:
          errorGroup.reduce((sum, port) => sum + port.x, 0) / errorGroup.length,
        y:
          errorGroup.reduce((sum, port) => sum + port.y, 0) / errorGroup.length,
      },
      pcb_component_ids: Array.from(
        new Set(
          expectedPorts
            .map((port) => port.pcb_component_id)
            .filter(
              (componentId): componentId is string => componentId !== undefined,
            ),
        ),
      ),
      pcb_port_ids: expectedPorts.map((port) => port.pcb_port_id),
      subcircuit_id: primaryTrace.subcircuit_id ?? sourceNet.subcircuit_id,
    })
  }

  return errors
}
