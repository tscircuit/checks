import type { AnyCircuitElement } from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import {
  type ConnectivityNetId,
  PcbConnectivityContext,
  type PcbPortId,
  type SourceNetId,
} from "../util/pcb-connectivity-context"
import { PcbCopperConnectivity } from "../util/pcb-copper-connectivity"

/** Physical same-net copper connectivity requiring a copper-pour path. */
export function getCopperPourConnectivity(
  circuitJson: AnyCircuitElement[],
  connectivity: ConnectivityMap,
) {
  const context = new PcbConnectivityContext(circuitJson)
  const pouredNetIds = new Set<ConnectivityNetId>()
  for (const copperElement of context.copperElements) {
    if (
      copperElement.type !== "pcb_copper_pour" ||
      !copperElement.source_net_id
    )
      continue
    const netId = connectivity.getNetConnectedToId(copperElement.source_net_id)
    if (netId) pouredNetIds.add(netId)
  }
  const pcbCopperConnectivity = new PcbCopperConnectivity(
    {
      connectivity,
      netIds: pouredNetIds,
      ignoreInlineVias: true,
      restrictToSameNet: true,
    },
    context,
  )
  const pcbPortIdsByNetId = new Map<ConnectivityNetId, PcbPortId[]>()
  for (const pcbPort of context.pcbPorts) {
    const netId = connectivity.getNetConnectedToId(pcbPort.pcb_port_id)
    if (!netId || !pouredNetIds.has(netId)) continue
    const pcbPortIds = pcbPortIdsByNetId.get(netId) ?? []
    pcbPortIds.push(pcbPort.pcb_port_id)
    pcbPortIdsByNetId.set(netId, pcbPortIds)
  }
  return {
    isPortConnectedToNet(pcbPortId: PcbPortId, sourceNetIds: SourceNetId[]) {
      for (const sourceNetId of sourceNetIds) {
        const netId = connectivity.getNetConnectedToId(sourceNetId)
        if (!netId) return false
        if (
          !pcbCopperConnectivity.isPortConnectedThroughPour({
            pcbPortId,
            netId,
            requiredPcbPortIds: pcbPortIdsByNetId.get(netId) ?? [],
          })
        )
          return false
      }
      return true
    },
    arePortsConnected(pcbPortIds: PcbPortId[]) {
      return pcbCopperConnectivity.arePortsConnectedThroughPour(pcbPortIds)
    },
  }
}
