import type { AnyCircuitElement, PcbPort, SourceNet } from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { getPcbCopperConnectivity } from "../util/get-pcb-copper-connectivity"

/** Physical same-net copper connectivity requiring a copper-pour path. */
export function getCopperPourConnectivity(
  circuitJson: AnyCircuitElement[],
  connectivity: ConnectivityMap,
) {
  const netForId = (id: string) => connectivity.getNetConnectedToId(id)
  const pouredNets = new Set(
    circuitJson.flatMap((e) => {
      const netId =
        e.type === "pcb_copper_pour" && e.source_net_id
          ? netForId(e.source_net_id)
          : undefined
      return netId ? [netId] : []
    }),
  )
  const { rootsByPort, pourRoots, netIdByRoot } = getPcbCopperConnectivity(
    circuitJson,
    connectivity,
    { netIds: pouredNets, includeInlineVias: false, restrictToSameNet: true },
  )
  const portsByNet = new Map<string, string[]>()
  for (const port of circuitJson) {
    if (port.type !== "pcb_port") continue
    const netId = netForId(port.pcb_port_id)
    if (!netId || !pouredNets.has(netId)) continue
    const ports = portsByNet.get(netId) ?? []
    ports.push(port.pcb_port_id)
    portsByNet.set(netId, ports)
  }
  return {
    isPortConnectedToNet(
      portId: PcbPort["pcb_port_id"],
      sourceNetIds: SourceNet["source_net_id"][],
    ) {
      return sourceNetIds.every((id) =>
        [...(rootsByPort.get(portId) ?? [])].some(
          (root) =>
            pourRoots.has(root) &&
            netIdByRoot.get(root) === netForId(id) &&
            (portsByNet.get(netIdByRoot.get(root)!) ?? []).every((peer) =>
              rootsByPort.get(peer)?.has(root),
            ),
        ),
      )
    },
    arePortsConnected(portIds: PcbPort["pcb_port_id"][]) {
      return (
        portIds.length >= 2 &&
        [...(rootsByPort.get(portIds[0]) ?? [])].some(
          (root) =>
            pourRoots.has(root) &&
            portIds.every((id) => rootsByPort.get(id)?.has(root)),
        )
      )
    },
  }
}
