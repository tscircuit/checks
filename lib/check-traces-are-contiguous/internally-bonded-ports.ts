import type { AnyCircuitElement, PcbPort, SourcePort } from "circuit-json"

type PcbPortId = PcbPort["pcb_port_id"]
type SourcePortId = SourcePort["source_port_id"]

/** PCB ports joined inside a component, such as the bonded legs of a push button. */
export function getInternallyBondedPcbPortIds(
  circuitJson: AnyCircuitElement[],
): Map<PcbPortId, PcbPortId[]> {
  const pcbPortIdsBySourcePortId = new Map<SourcePortId, PcbPortId[]>()
  for (const element of circuitJson) {
    if (element.type !== "pcb_port") continue
    const pcbPortIds =
      pcbPortIdsBySourcePortId.get(element.source_port_id) ?? []
    pcbPortIds.push(element.pcb_port_id)
    pcbPortIdsBySourcePortId.set(element.source_port_id, pcbPortIds)
  }

  const bondedPcbPortIds = new Map<PcbPortId, PcbPortId[]>()
  const addBond = (sourcePortIds: SourcePortId[]) => {
    const pcbPortIds = sourcePortIds.flatMap(
      (sourcePortId) => pcbPortIdsBySourcePortId.get(sourcePortId) ?? [],
    )
    for (const pcbPortId of pcbPortIds) {
      bondedPcbPortIds.set(pcbPortId, [
        ...(bondedPcbPortIds.get(pcbPortId) ?? []),
        ...pcbPortIds.filter((otherPortId) => otherPortId !== pcbPortId),
      ])
    }
  }
  for (const element of circuitJson) {
    if (element.type === "source_component") {
      for (const sourcePortIds of element.internally_connected_source_port_ids ??
        []) {
        addBond(sourcePortIds)
      }
    }
    if (element.type === "source_component_internal_connection") {
      addBond(element.source_port_ids)
    }
  }
  return bondedPcbPortIds
}
