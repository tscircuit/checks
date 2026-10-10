import type {
  AnyCircuitElement,
  PcbPort,
  PcbPortNotConnectedError,
  SourceNet,
} from "circuit-json"
import {
  getReadableNameForElementId,
  getReadableNameForPort,
} from "./util/get-readable-names"

type PcbPortId = PcbPort["pcb_port_id"]
type PcbComponentId = NonNullable<PcbPort["pcb_component_id"]>

export function createDisconnectedPcbNetError(
  {
    pcbPorts,
    pcbPortIdsByIsland,
    sourceNets,
  }: {
    pcbPorts: PcbPort[]
    pcbPortIdsByIsland: PcbPortId[][]
    sourceNets: SourceNet[]
  },
  circuitJson: AnyCircuitElement[],
): PcbPortNotConnectedError {
  const netNames = sourceNets.map((sourceNet) =>
    getReadableNameForElementId(circuitJson, sourceNet.source_net_id),
  )
  const netDescription = netNames.length
    ? `Net [${netNames.join(", ")}]`
    : "Net"
  const islandDescriptions: string[] = []
  for (const pcbPortIds of pcbPortIdsByIsland) {
    const portNames = pcbPortIds.map((pcbPortId) =>
      getReadableNameForPort(circuitJson, pcbPortId),
    )
    islandDescriptions.push(portNames.join(", "))
  }
  const pcbComponentIds = new Set<PcbComponentId>()
  for (const pcbPort of pcbPorts) {
    if (pcbPort.pcb_component_id) pcbComponentIds.add(pcbPort.pcb_component_id)
  }
  return {
    type: "pcb_port_not_connected_error",
    error_type: "pcb_port_not_connected_error",
    pcb_port_not_connected_error_id: `disconnected_pcb_net_${pcbPorts[0].pcb_port_id}`,
    pcb_port_ids: pcbPorts.map((pcbPort) => pcbPort.pcb_port_id),
    pcb_component_ids: [...pcbComponentIds],
    message: `${netDescription} has disconnected PCB copper: ${islandDescriptions.join(" | ")}.`,
  }
}
