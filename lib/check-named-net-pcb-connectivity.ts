import {
  pcb_port_not_connected_error,
  type AnyCircuitElement,
  type PcbPort,
  type PcbPortNotConnectedError,
} from "circuit-json"
import {
  ConnectivityMap,
  type PcbConnectivityMap,
} from "circuit-json-to-connectivity-map"
import { getCopperPourConnectivity } from "./copper-pour-connectivity/get-copper-pour-connectivity"
import {
  getReadableNameForPort,
  getReadableNameForElementId,
} from "./util/get-readable-names"

type PhysicalNetId = NonNullable<
  ReturnType<ConnectivityMap["getNetConnectedToId"]>
>

/** Physical trace/pour contacts plus explicitly declared internal connections.
 * Logical source-net membership never bridges separate copper islands.
 */
export function checkNamedNetPcbConnectivity({
  circuitJson,
  connMap,
  pcbConnectivityMap,
  portErrors,
}: {
  circuitJson: AnyCircuitElement[]
  connMap: ConnectivityMap
  pcbConnectivityMap: PcbConnectivityMap
  portErrors: PcbPortNotConnectedError[]
}) {
  const physicalConnectivity = new ConnectivityMap(
    structuredClone(pcbConnectivityMap.connMap.netMap),
  )
  physicalConnectivity.addConnections(
    getCopperPourConnectivity(circuitJson, connMap).getPortConnections(),
  )
  const sourcePortToPcbPortId = new Map(
    circuitJson
      .filter((e) => e.type === "pcb_port")
      .map((port) => [port.source_port_id, port.pcb_port_id]),
  )
  for (const element of circuitJson) {
    if (element.type === "pcb_via" && element.pcb_port_ids) {
      physicalConnectivity.addConnections([element.pcb_port_ids])
    }
    if (element.type !== "source_component") continue
    for (const sourcePortIds of element.internally_connected_source_port_ids ??
      []) {
      const pcbPortIds = sourcePortIds
        .map((id) => sourcePortToPcbPortId.get(id))
        .filter((id) => id !== undefined)
      physicalConnectivity.addConnections([pcbPortIds])
    }
  }
  const pcbPorts = circuitJson.filter((e) => e.type === "pcb_port")
  const checkedNets = new Set<PhysicalNetId>()
  const errors: PcbPortNotConnectedError[] = []
  for (const sourceNet of circuitJson) {
    if (sourceNet.type !== "source_net") continue
    const logicalNetId = connMap.getNetConnectedToId(sourceNet.source_net_id)
    if (!logicalNetId || checkedNets.has(logicalNetId)) continue
    checkedNets.add(logicalNetId)
    const ports = pcbPorts.filter(
      (port) => connMap.getNetConnectedToId(port.pcb_port_id) === logicalNetId,
    )
    if (ports.length < 2) continue
    // Existing missing-port errors already describe an incomplete net.
    if (
      portErrors.some((error) =>
        ports.some((port) => error.pcb_port_ids.includes(port.pcb_port_id)),
      )
    )
      continue
    const groups = new Map<PhysicalNetId, PcbPort[]>()
    for (const port of ports) {
      const physicalNetId = physicalConnectivity.getNetConnectedToId(
        port.pcb_port_id,
      )
      if (!physicalNetId) {
        groups.set(port.pcb_port_id, [port])
        continue
      }
      const group = groups.get(physicalNetId) ?? []
      group.push(port)
      groups.set(physicalNetId, group)
    }
    if (groups.size < 2) continue
    const groupNames = [...groups.values()].map((group) =>
      group
        .map((port) => getReadableNameForPort(circuitJson, port.pcb_port_id))
        .join(", "),
    )
    errors.push(
      pcb_port_not_connected_error.parse({
        type: "pcb_port_not_connected_error",
        message: `Net [${getReadableNameForElementId(circuitJson, sourceNet.source_net_id)}] has disconnected PCB copper: ${groupNames.join(" | ")}.`,
        pcb_port_ids: ports.map((port) => port.pcb_port_id),
        pcb_component_ids: [
          ...new Set(
            ports
              .map((port) => port.pcb_component_id)
              .filter((id) => id !== undefined),
          ),
        ],
        subcircuit_id: sourceNet.subcircuit_id,
      }),
    )
  }
  return errors
}
