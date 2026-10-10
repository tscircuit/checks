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

interface PcbNetRequirement {
  netId: ConnectivityNetId
  pcbPorts: PcbPort[]
  sourceNets: SourceNet[]
}

/** Only explicit source traces require a PCB bridge. Component-internal
 * connections, matching names, and connectivity-map keys do not add edges. */
export function getPcbNetRequirements(context: PcbConnectivityContext) {
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
  const sourceConnectivity = new ConnectivityMap(
    findConnectedNetworks(sourceConnections),
  )
  const requirementsByNetId = new Map<ConnectivityNetId, PcbNetRequirement>()
  for (const pcbPort of context.pcbPorts) {
    if (!requiredSourcePortIds.has(pcbPort.source_port_id)) continue
    const netId = sourceConnectivity.getNetConnectedToId(pcbPort.source_port_id)
    if (!netId) continue
    let netRequirement = requirementsByNetId.get(netId)
    if (!netRequirement) {
      netRequirement = { netId, pcbPorts: [], sourceNets: [] }
      requirementsByNetId.set(netId, netRequirement)
    }
    netRequirement.pcbPorts.push(pcbPort)
  }
  for (const sourceNet of context.sourceNets) {
    const netId = sourceConnectivity.getNetConnectedToId(
      sourceNet.source_net_id,
    )
    if (netId) requirementsByNetId.get(netId)?.sourceNets.push(sourceNet)
  }
  const netRequirements: PcbNetRequirement[] = []
  for (const netRequirement of requirementsByNetId.values()) {
    if (netRequirement.pcbPorts.length > 1) netRequirements.push(netRequirement)
  }
  return { sourceConnectivity, netRequirements }
}
