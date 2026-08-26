import type {
  AnyCircuitElement,
  PcbPort,
  PcbTrace,
  PcbTraceError,
  SourceNet,
  SourceTrace,
} from "circuit-json"
import {
  PhysicalPcbConnectivityMap,
  type PhysicalCopperGroupId,
} from "lib/physical-pcb-connectivity/PhysicalPcbConnectivityMap"

export function checkSourceNetsArePhysicallyConnected(
  circuitJson: AnyCircuitElement[],
): PcbTraceError[] {
  const physicalPcbConnectivityMap = new PhysicalPcbConnectivityMap(circuitJson)
  const pcbPorts = circuitJson.filter(
    (element) => element.type === "pcb_port",
  ) as PcbPort[]
  const pcbTraces = circuitJson.filter(
    (element) => element.type === "pcb_trace",
  ) as PcbTrace[]
  const sourceTraces = circuitJson.filter(
    (element) => element.type === "source_trace",
  ) as SourceTrace[]
  const sourceNets = circuitJson.filter(
    (element) => element.type === "source_net",
  ) as SourceNet[]
  const errors: PcbTraceError[] = []

  for (const sourceNet of sourceNets) {
    const sourceTracesForNet = sourceTraces.filter((sourceTrace) =>
      sourceTrace.connected_source_net_ids?.includes(sourceNet.source_net_id),
    )
    const sourceTraceIdsForNet = new Set(
      sourceTracesForNet.map((sourceTrace) => sourceTrace.source_trace_id),
    )
    const expectedSourcePortIds = new Set(
      sourceTracesForNet.flatMap(
        (sourceTrace) => sourceTrace.connected_source_port_ids ?? [],
      ),
    )
    const expectedPorts = pcbPorts.filter((pcbPort) =>
      expectedSourcePortIds.has(pcbPort.source_port_id),
    )
    if (expectedPorts.length < 2) continue

    const routedTracesForNet = pcbTraces.filter(
      (pcbTrace) =>
        pcbTrace.source_trace_id === sourceNet.source_net_id ||
        (pcbTrace.source_trace_id !== undefined &&
          sourceTraceIdsForNet.has(pcbTrace.source_trace_id)),
    )
    if (routedTracesForNet.length === 0) continue

    const portsByPhysicalGroup = new Map<PhysicalCopperGroupId, PcbPort[]>()
    for (const port of expectedPorts) {
      const physicalGroupId =
        physicalPcbConnectivityMap.getPhysicalGroupIdForPort(port.pcb_port_id)
      if (!physicalGroupId) continue
      portsByPhysicalGroup.set(physicalGroupId, [
        ...(portsByPhysicalGroup.get(physicalGroupId) ?? []),
        port,
      ])
    }
    if (portsByPhysicalGroup.size <= 1) continue

    const disconnectedGroups = Array.from(portsByPhysicalGroup.values()).sort(
      (firstGroup, secondGroup) => secondGroup.length - firstGroup.length,
    )
    const errorGroup = disconnectedGroups[1] ?? disconnectedGroups[0]
    const primaryTrace = routedTracesForNet[0]
    if (!errorGroup || !primaryTrace) continue

    errors.push({
      type: "pcb_trace_error",
      message: `Net [${sourceNet.name || "unnamed net"}] has ${expectedPorts.length} required PCB ports split across ${portsByPhysicalGroup.size} disconnected copper groups.`,
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
              (pcbComponentId): pcbComponentId is string =>
                pcbComponentId !== undefined,
            ),
        ),
      ),
      pcb_port_ids: expectedPorts.map((port) => port.pcb_port_id),
      subcircuit_id: primaryTrace.subcircuit_id ?? sourceNet.subcircuit_id,
    })
  }

  return errors
}
