import type { AnyCircuitElement, PcbPortNotConnectedError } from "circuit-json"
import {
  ConnectivityMap,
  findConnectedNetworks,
} from "circuit-json-to-connectivity-map"
import { getPcbCopperConnectivity } from "./util/get-pcb-copper-connectivity"
import {
  getReadableNameForElementId,
  getReadableNameForPort,
} from "./util/get-readable-names"

/** Check complete PCB nets independently of individual trace ownership/endpoints.
 * Only explicit source traces define required copper connections. Internal
 * component connections and shared labels/keys do not require a PCB bridge.
 * Missing emitted copper and unsupported special routes defer affected nets;
 * an empty result is not a continuity proof for those geometries.
 */
export function checkPcbNetsAreConnected(
  circuitJson: AnyCircuitElement[],
): PcbPortNotConnectedError[] {
  const sourceTraces = circuitJson.filter((e) => e.type === "source_trace")
  const sourceConnectivity = new ConnectivityMap(
    findConnectedNetworks(
      sourceTraces.map((trace) => [
        trace.source_trace_id,
        ...trace.connected_source_port_ids,
        ...trace.connected_source_net_ids,
      ]),
    ),
  )
  const requiredSourcePorts = new Set(
    sourceTraces.flatMap((t) => t.connected_source_port_ids),
  )
  for (const port of circuitJson) {
    if (port.type === "source_port" && port.do_not_connect)
      requiredSourcePorts.delete(port.source_port_id)
  }
  const portsByNet = new Map<
    string,
    Extract<AnyCircuitElement, { type: "pcb_port" }>[]
  >()
  for (const port of circuitJson) {
    if (
      port.type !== "pcb_port" ||
      !requiredSourcePorts.has(port.source_port_id)
    )
      continue
    const net = sourceConnectivity.getNetConnectedToId(port.source_port_id)
    if (!net) continue
    const ports = portsByNet.get(net) ?? []
    ports.push(port)
    portsByNet.set(net, ports)
  }
  if (![...portsByNet.values()].some((ports) => ports.length > 1)) return []
  const copper = getPcbCopperConnectivity(circuitJson, sourceConnectivity)
  const errors: PcbPortNotConnectedError[] = []
  for (const [net, ports] of portsByNet) {
    if (
      ports.length < 2 ||
      copper.unsupportedNetIds.has(net) ||
      ports.some((port) => copper.unsupportedPortIds.has(port.pcb_port_id))
    )
      continue
    const roots =
      copper.rootsByPort.get(ports[0].pcb_port_id) ?? new Set<number>()
    if (
      [...roots].some((root) =>
        ports.every((p) => copper.rootsByPort.get(p.pcb_port_id)?.has(root)),
      )
    )
      continue
    const islands = new Map<number | string, string[]>()
    for (const port of ports) {
      const root =
        copper.rootsByPort.get(port.pcb_port_id)?.values().next().value ??
        port.pcb_port_id
      const names = islands.get(root) ?? []
      names.push(getReadableNameForPort(circuitJson, port.pcb_port_id))
      islands.set(root, names)
    }
    const netNames = circuitJson.flatMap((e) =>
      e.type === "source_net" &&
      sourceConnectivity.getNetConnectedToId(e.source_net_id) === net
        ? [getReadableNameForElementId(circuitJson, e.source_net_id)]
        : [],
    )
    errors.push({
      type: "pcb_port_not_connected_error",
      error_type: "pcb_port_not_connected_error",
      pcb_port_not_connected_error_id: `disconnected_pcb_net_${ports[0].pcb_port_id}`,
      pcb_port_ids: ports.map((p) => p.pcb_port_id),
      pcb_component_ids: [
        ...new Set(
          ports.flatMap((p) =>
            p.pcb_component_id ? [p.pcb_component_id] : [],
          ),
        ),
      ],
      message: `${netNames.length ? `Net [${netNames.join(", ")}]` : "Net"} has disconnected PCB copper: ${[...islands.values()].map((names) => names.join(", ")).join(" | ")}.`,
    })
  }
  return errors
}
