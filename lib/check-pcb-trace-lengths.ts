import type {
  AnyCircuitElement,
  PcbBoard,
  PcbPort,
  PcbTrace,
  PcbTraceTooLongWarning,
  SourceTrace,
} from "circuit-json"
import { getSourcePortConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import {
  buildPcbTracePathGraph,
  getShortestPcbTracePath,
  type PcbTracePath,
  type PcbTracePathGraph,
} from "./pcb-trace-path-graph"

const createTraceTooLongWarning = ({
  sourceTrace,
  pcbTrace,
  actualTraceLength,
  maximumTraceLength,
}: {
  sourceTrace: SourceTrace
  pcbTrace: PcbTrace
  actualTraceLength: number
  maximumTraceLength: number
}): PcbTraceTooLongWarning => ({
  type: "pcb_trace_too_long_warning",
  pcb_trace_too_long_warning_id: `pcb_trace_too_long_warning_${sourceTrace.source_trace_id}_${pcbTrace.pcb_trace_id}`,
  warning_type: "pcb_trace_too_long_warning",
  message: `PCB trace is ${actualTraceLength.toFixed(2)}mm long, exceeding the ${maximumTraceLength}mm maximum`,
  pcb_trace_id: pcbTrace.pcb_trace_id,
  source_trace_id: sourceTrace.source_trace_id,
  source_net_id: sourceTrace.connected_source_net_ids[0],
  actual_trace_length: actualTraceLength,
  maximum_trace_length: maximumTraceLength,
  subcircuit_id: pcbTrace.subcircuit_id ?? sourceTrace.subcircuit_id,
})

export const checkPcbTraceLengths = (
  circuitJson: AnyCircuitElement[],
): PcbTraceTooLongWarning[] => {
  const sourceTraces = circuitJson.filter(
    (element): element is SourceTrace => element.type === "source_trace",
  )
  const pcbTraces = circuitJson.filter(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )
  const pcbPorts = circuitJson.filter(
    (element): element is PcbPort => element.type === "pcb_port",
  )
  const pcbBoards = circuitJson.filter(
    (element): element is PcbBoard => element.type === "pcb_board",
  )

  const sourceConnectivityMap =
    getSourcePortConnectivityMapFromCircuitJson(circuitJson)
  const sourceTraceIdsByConnectivityNetId = new Map<string, Set<string>>()
  const pcbPortIdsBySourcePortId = new Map<string, string[]>()
  const traceGraphsByConnectivityNetId = new Map<string, PcbTracePathGraph>()

  for (const sourceTrace of sourceTraces) {
    for (const connectedSourceId of [
      ...sourceTrace.connected_source_port_ids,
      ...sourceTrace.connected_source_net_ids,
    ]) {
      const connectivityNetId =
        sourceConnectivityMap.getNetConnectedToId(connectedSourceId)
      if (!connectivityNetId) continue
      const sourceTraceIds =
        sourceTraceIdsByConnectivityNetId.get(connectivityNetId) ??
        new Set<string>()
      sourceTraceIds.add(sourceTrace.source_trace_id)
      sourceTraceIdsByConnectivityNetId.set(connectivityNetId, sourceTraceIds)
    }
  }

  for (const pcbPort of pcbPorts) {
    if (!pcbPort.source_port_id) continue
    const pcbPortIds =
      pcbPortIdsBySourcePortId.get(pcbPort.source_port_id) ?? []
    pcbPortIds.push(pcbPort.pcb_port_id)
    pcbPortIdsBySourcePortId.set(pcbPort.source_port_id, pcbPortIds)
  }

  const getTraceGraph = (
    connectivityNetId: string,
    sourceTrace: SourceTrace,
  ) => {
    let graph = traceGraphsByConnectivityNetId.get(connectivityNetId)
    if (graph) return graph

    const connectedSourceTraceIds =
      sourceTraceIdsByConnectivityNetId.get(connectivityNetId) ??
      new Set([sourceTrace.source_trace_id])
    const matchingSubcircuitBoard = sourceTrace.subcircuit_id
      ? pcbBoards.find(
          (pcbBoard) => pcbBoard.subcircuit_id === sourceTrace.subcircuit_id,
        )
      : undefined
    const sourceTraceBoard =
      matchingSubcircuitBoard ??
      (pcbBoards.length === 1 ? pcbBoards[0] : undefined)
    graph = buildPcbTracePathGraph(
      pcbTraces.filter(
        (pcbTrace) =>
          pcbTrace.source_trace_id !== undefined &&
          connectedSourceTraceIds.has(pcbTrace.source_trace_id),
      ),
      pcbPorts,
      {
        viaLength: sourceTraceBoard?.thickness,
      },
    )
    traceGraphsByConnectivityNetId.set(connectivityNetId, graph)
    return graph
  }

  const getEndpointPath = (
    sourceTrace: SourceTrace,
  ): PcbTracePath | undefined => {
    const explicitSourcePortIds = sourceTrace.connected_source_port_ids
    // A source-net endpoint can represent any branch on a multidrop net, so it
    // does not identify a unique physical path whose length can be constrained.
    if (explicitSourcePortIds.length !== 2) {
      return undefined
    }

    const connectivityNetId = sourceConnectivityMap.getNetConnectedToId(
      explicitSourcePortIds[0]!,
    )
    if (!connectivityNetId) return undefined

    const startPcbPortIds =
      pcbPortIdsBySourcePortId.get(explicitSourcePortIds[0]!) ?? []
    if (
      sourceConnectivityMap.getNetConnectedToId(explicitSourcePortIds[1]!) !==
      connectivityNetId
    ) {
      return undefined
    }
    const endPcbPortIds =
      pcbPortIdsBySourcePortId.get(explicitSourcePortIds[1]!) ?? []

    if (!startPcbPortIds.length || !endPcbPortIds.length) return undefined
    return getShortestPcbTracePath(
      getTraceGraph(connectivityNetId, sourceTrace),
      startPcbPortIds,
      endPcbPortIds,
    )
  }

  const pcbTracesById = new Map(
    pcbTraces.map((pcbTrace) => [pcbTrace.pcb_trace_id, pcbTrace]),
  )
  const warnings: PcbTraceTooLongWarning[] = []

  for (const sourceTrace of sourceTraces) {
    const maximumTraceLength = sourceTrace.max_length
    if (typeof maximumTraceLength !== "number") continue
    if (sourceTrace.connected_source_port_ids.length !== 2) continue

    const endpointPath = getEndpointPath(sourceTrace)
    // Disconnected endpoints do not have a physical length. The trace
    // contiguity checks own that diagnostic.
    if (!endpointPath || endpointPath.length <= maximumTraceLength) continue

    const representativePcbTrace =
      endpointPath.pcbTraceIds
        .map((pcbTraceId) => pcbTracesById.get(pcbTraceId))
        .find(
          (pcbTrace) =>
            pcbTrace?.source_trace_id === sourceTrace.source_trace_id,
        ) ??
      endpointPath.pcbTraceIds
        .map((pcbTraceId) => pcbTracesById.get(pcbTraceId))
        .find((pcbTrace): pcbTrace is PcbTrace => pcbTrace !== undefined)
    if (!representativePcbTrace) continue

    warnings.push(
      createTraceTooLongWarning({
        sourceTrace,
        pcbTrace: representativePcbTrace,
        actualTraceLength: endpointPath.length,
        maximumTraceLength,
      }),
    )
  }

  return warnings
}
