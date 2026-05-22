import type {
  AnyCircuitElement,
  PcbPort,
  PcbTrace,
  PcbTraceMissingError,
  SourceTrace,
} from "circuit-json"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

const getSourceTraceIdsFromPcbTrace = (
  pcbTraceSourceTraceId?: string,
): string[] => {
  if (!pcbTraceSourceTraceId) return []
  if (!pcbTraceSourceTraceId.includes("__")) return [pcbTraceSourceTraceId]

  return pcbTraceSourceTraceId
    .split("__")
    .filter((part) => part.startsWith("source_trace_"))
}

/**
 * Check that each source_trace which connects source ports has at least one
 * pcb_trace associated with it. If a source_trace has no corresponding
 * pcb_trace, return an error for that source_trace.
 */
function checkSourceTracesHavePcbTraces(
  circuitJson: AnyCircuitElement[],
): PcbTraceMissingError[] {
  const errors: PcbTraceMissingError[] = []
  const sourceTraces = circuitJson.filter(
    (el) => el.type === "source_trace",
  ) as SourceTrace[]
  const pcbTraces = circuitJson.filter(
    (el) => el.type === "pcb_trace",
  ) as PcbTrace[]
  const pcbPorts = circuitJson.filter(
    (el) => el.type === "pcb_port",
  ) as PcbPort[]
  const sourcePortToPcbPort = new Map(
    pcbPorts.map((pcbPort) => [pcbPort.source_port_id, pcbPort]),
  )
  const connectivityMap = getFullConnectivityMapFromCircuitJson(circuitJson)

  for (const sourceTrace of sourceTraces) {
    if (!sourceTrace.connected_source_port_ids?.length) continue
    if ((sourceTrace.connected_source_net_ids?.length ?? 0) > 0) continue
    if (sourceTrace.connected_source_port_ids.length < 2) continue

    const connectedPcbPorts = sourceTrace.connected_source_port_ids
      .map((sourcePortId) => sourcePortToPcbPort.get(sourcePortId))
      .filter((pcbPort): pcbPort is PcbPort => pcbPort !== undefined)

    const hasExplicitlyAssociatedPcbTrace = pcbTraces.some((pcbTrace) =>
      getSourceTraceIdsFromPcbTrace(pcbTrace.source_trace_id).includes(
        sourceTrace.source_trace_id,
      ),
    )

    let hasConnectedPcbTrace = false
    if (connectedPcbPorts.length >= 2) {
      const referencePcbPortId = connectedPcbPorts[0].pcb_port_id
      const referenceNetId =
        connectivityMap.getNetConnectedToId(referencePcbPortId)

      if (
        referenceNetId &&
        connectedPcbPorts.every((pcbPort) =>
          connectivityMap.areIdsConnected(
            referencePcbPortId,
            pcbPort.pcb_port_id,
          ),
        )
      ) {
        const netElementIds =
          connectivityMap.getIdsConnectedToNet(referenceNetId)
        hasConnectedPcbTrace = pcbTraces.some((pcbTrace) =>
          netElementIds.includes(pcbTrace.pcb_trace_id),
        )
      }
    }

    if (!hasExplicitlyAssociatedPcbTrace && !hasConnectedPcbTrace) {
      // Find PCB components that these ports belong to
      const connectedPcbComponentIds = Array.from(
        new Set(
          connectedPcbPorts
            .map((port) => port.pcb_component_id)
            .filter((id): id is string => id !== undefined),
        ),
      )

      errors.push({
        type: "pcb_trace_missing_error",
        pcb_trace_missing_error_id: `pcb_trace_missing_${sourceTrace.source_trace_id}`,
        error_type: "pcb_trace_missing_error",
        message: `Trace [${sourceTrace.display_name && !containsCircuitJsonId(sourceTrace.display_name) ? sourceTrace.display_name : "trace"}] is not connected (it has no PCB trace)`,
        source_trace_id: sourceTrace.source_trace_id,
        pcb_component_ids: connectedPcbComponentIds,
        pcb_port_ids: connectedPcbPorts.map((port) => port.pcb_port_id),
      })
    }
  }

  return errors
}

export { checkSourceTracesHavePcbTraces }
