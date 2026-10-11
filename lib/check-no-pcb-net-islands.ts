import type {
  AnyCircuitElement,
  PcbPort,
  PcbPortNotConnectedError,
} from "circuit-json"
import {
  ConnectivityMap,
  findConnectedNetworks,
  getFullConnectivityMapFromCircuitJson,
  type PcbConnectivityMap,
} from "circuit-json-to-connectivity-map"
import { getCopperPourConnectivity } from "./copper-pour-connectivity/get-copper-pour-connectivity"
import { createDisconnectedPcbNetError } from "./create-disconnected-pcb-net-error"
import { createIndexedPcbConnectivityMap } from "./util/create-indexed-pcb-connectivity-map"
import { getPcbNetsToCheck } from "./util/get-pcb-nets-to-check"

type PcbPortId = PcbPort["pcb_port_id"]
type PcbIslandId = string

/** Reports one error per logical net whose intended PCB ports span copper islands. */
export function checkNoPcbNetIslands(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    pcbConnectivityMap,
  }: {
    connMap?: ConnectivityMap
    pcbConnectivityMap?: PcbConnectivityMap
  } = {},
): PcbPortNotConnectedError[] {
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
  const pcbNetsToCheck = getPcbNetsToCheck(circuitJson, connMap)
  if (!pcbNetsToCheck.length) return []
  pcbConnectivityMap ??= createIndexedPcbConnectivityMap(circuitJson)

  // Include pour-only pad connections without changing either shared map.
  let pcbConnMap = pcbConnectivityMap.connMap
  if (circuitJson.some((element) => element.type === "pcb_copper_pour")) {
    const pourConnectivity = getCopperPourConnectivity(circuitJson, connMap)
    pcbConnMap = new ConnectivityMap(
      findConnectedNetworks([
        ...Object.values(pcbConnMap.netMap),
        ...pourConnectivity.getConnections(),
      ]),
    )
  }

  const errors: PcbPortNotConnectedError[] = []
  for (const { pcbPorts, sourceNets } of pcbNetsToCheck) {
    const pcbPortIdsByIslandId = new Map<PcbIslandId, PcbPortId[]>()
    for (const pcbPort of pcbPorts) {
      const pcbPortId = pcbPort.pcb_port_id
      // Unrouted ports have no physical net ID and form separate islands.
      const islandId = pcbConnMap.getNetConnectedToId(pcbPortId) ?? pcbPortId
      const pcbPortIds = pcbPortIdsByIslandId.get(islandId) ?? []
      pcbPortIds.push(pcbPortId)
      pcbPortIdsByIslandId.set(islandId, pcbPortIds)
    }
    if (pcbPortIdsByIslandId.size < 2) continue
    errors.push(
      createDisconnectedPcbNetError(
        {
          pcbPorts,
          pcbPortIdsByIsland: [...pcbPortIdsByIslandId.values()],
          sourceNets,
        },
        circuitJson,
      ),
    )
  }
  return errors
}
