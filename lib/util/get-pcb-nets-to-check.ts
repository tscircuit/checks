import type { PcbPort, SourceNet } from "circuit-json"
import {
  ConnectivityMap,
  findConnectedNetworks,
} from "circuit-json-to-connectivity-map"
import type {
  ConnectivityNetId,
  PcbConnectivityContext,
  SourcePortId,
} from "./pcb-connectivity-context"

interface PcbNetToCheck {
  netId: ConnectivityNetId
  pcbPorts: PcbPort[]
  sourceNets: SourceNet[]
}

/** Groups two or more eligible emitted PCB ports per logical net.
 * Only explicit source traces require a PCB bridge. Component-internal
 * connections, matching names, and connectivity-map keys do not add edges. */
export function getPcbNetsToCheck(context: PcbConnectivityContext) {
  const sourceConnections: string[][] = []
  const requiredSourcePortIds = new Set<SourcePortId>()
  for (const sourceTrace of context.sourceTraces) {
    sourceConnections.push([
      sourceTrace.source_trace_id,
      ...sourceTrace.connected_source_port_ids,
      ...sourceTrace.connected_source_net_ids,
    ])
    for (const sourcePortId of sourceTrace.connected_source_port_ids)
      requiredSourcePortIds.add(sourcePortId)
  }
  for (const sourcePort of context.sourcePorts) {
    if (sourcePort.do_not_connect)
      requiredSourcePortIds.delete(sourcePort.source_port_id)
  }
  const sourceTraceConnectivityMap = new ConnectivityMap(
    findConnectedNetworks(sourceConnections),
  )
  const pcbNetsByNetId = new Map<ConnectivityNetId, PcbNetToCheck>()
  for (const pcbPort of context.pcbPorts) {
    if (!requiredSourcePortIds.has(pcbPort.source_port_id)) continue
    const netId = sourceTraceConnectivityMap.getNetConnectedToId(
      pcbPort.source_port_id,
    )
    if (!netId) continue
    let pcbNet = pcbNetsByNetId.get(netId)
    if (!pcbNet) {
      pcbNet = { netId, pcbPorts: [], sourceNets: [] }
      pcbNetsByNetId.set(netId, pcbNet)
    }
    pcbNet.pcbPorts.push(pcbPort)
  }
  for (const sourceNet of context.sourceNets) {
    const netId = sourceTraceConnectivityMap.getNetConnectedToId(
      sourceNet.source_net_id,
    )
    if (netId) pcbNetsByNetId.get(netId)?.sourceNets.push(sourceNet)
  }
  const pcbNetsToCheck: PcbNetToCheck[] = []
  for (const pcbNet of pcbNetsByNetId.values()) {
    if (pcbNet.pcbPorts.length > 1) pcbNetsToCheck.push(pcbNet)
  }
  return { sourceTraceConnectivityMap, pcbNetsToCheck }
}
