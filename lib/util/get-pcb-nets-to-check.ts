import type {
  AnyCircuitElement,
  PcbPort,
  SourceNet,
  SourcePort,
} from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"

type NetId = NonNullable<ReturnType<ConnectivityMap["getNetConnectedToId"]>>
type SourcePortId = SourcePort["source_port_id"]
type PcbPortId = PcbPort["pcb_port_id"]

interface PcbNetToCheck {
  pcbPorts: PcbPort[]
  sourceNets: SourceNet[]
}

/** Select explicitly declared PCB ports without changing logical net membership. */
export function getPcbNetsToCheck(
  circuitJson: AnyCircuitElement[],
  connMap: ConnectivityMap,
): PcbNetToCheck[] {
  const sourcePortIdsInTraces = new Set<SourcePortId>()
  const doNotConnectSourcePortIds = new Set<SourcePortId>()
  const pcbPortIdsWithCopper = new Set<PcbPortId>()
  const pcbPorts: PcbPort[] = []
  const sourceNets: SourceNet[] = []

  for (const element of circuitJson) {
    switch (element.type) {
      case "source_trace":
        for (const portId of element.connected_source_port_ids)
          sourcePortIdsInTraces.add(portId)
        break
      case "source_port":
        if (element.do_not_connect)
          doNotConnectSourcePortIds.add(element.source_port_id)
        break
      case "pcb_port":
        pcbPorts.push(element)
        break
      case "source_net":
        sourceNets.push(element)
        break
      case "pcb_smtpad":
      case "pcb_plated_hole":
        if (element.pcb_port_id) pcbPortIdsWithCopper.add(element.pcb_port_id)
        break
      case "pcb_via":
        for (const portId of element.pcb_port_ids ?? [])
          pcbPortIdsWithCopper.add(portId)
        break
    }
  }
  for (const portId of doNotConnectSourcePortIds)
    sourcePortIdsInTraces.delete(portId)

  const pcbNetsByNetId = new Map<NetId, PcbNetToCheck>()
  for (const pcbPort of pcbPorts) {
    if (!sourcePortIdsInTraces.has(pcbPort.source_port_id)) continue
    const netId = connMap.getNetConnectedToId(pcbPort.pcb_port_id)
    if (!netId) continue
    let pcbNet = pcbNetsByNetId.get(netId)
    if (!pcbNet) {
      pcbNet = { pcbPorts: [], sourceNets: [] }
      pcbNetsByNetId.set(netId, pcbNet)
    }
    pcbNet.pcbPorts.push(pcbPort)
  }
  for (const sourceNet of sourceNets) {
    const netId = connMap.getNetConnectedToId(sourceNet.source_net_id)
    if (netId) pcbNetsByNetId.get(netId)?.sourceNets.push(sourceNet)
  }
  const pcbNetsToCheck: PcbNetToCheck[] = []
  for (const pcbNet of pcbNetsByNetId.values()) {
    if (pcbNet.pcbPorts.length < 2) continue
    // A missing pad or barrel leaves this net's copper connectivity unverified.
    if (
      pcbNet.pcbPorts.some(
        (port) => !pcbPortIdsWithCopper.has(port.pcb_port_id),
      )
    )
      continue
    pcbNetsToCheck.push(pcbNet)
  }
  return pcbNetsToCheck
}
