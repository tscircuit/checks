import type {
  AnyCircuitElement,
  PcbComponent,
  PcbPortNotMatchedError,
} from "circuit-json"
import { getReadableNameForSourcePort } from "./util/get-readable-names"

/**
 * Report connected source ports on PCB components that have no corresponding
 * pcb_port. Without that mapping, placement and routing checks cannot follow
 * the electrical connection to its physical pad.
 */
export function checkSourcePortsHavePcbPorts(
  circuitJson: AnyCircuitElement[],
): PcbPortNotMatchedError[] {
  const connectedSourcePortIds = new Set(
    circuitJson.flatMap((element) =>
      element.type === "source_trace"
        ? (element.connected_source_port_ids ?? [])
        : [],
    ),
  )
  const internalConnectionGroups = circuitJson.flatMap((element) => {
    if (element.type === "source_component_internal_connection") {
      return [element.source_port_ids]
    }
    if (element.type === "source_component") {
      return element.internally_connected_source_port_ids ?? []
    }
    return []
  })

  let foundNewConnectedPort = true
  while (foundNewConnectedPort) {
    foundNewConnectedPort = false
    for (const group of internalConnectionGroups) {
      if (
        !group.some((sourcePortId) => connectedSourcePortIds.has(sourcePortId))
      ) {
        continue
      }
      for (const sourcePortId of group) {
        if (connectedSourcePortIds.has(sourcePortId)) continue
        connectedSourcePortIds.add(sourcePortId)
        foundNewConnectedPort = true
      }
    }
  }

  const pcbPorts = circuitJson.filter((element) => element.type === "pcb_port")
  const sourceComponentIdsWithFootprintErrors = new Set(
    circuitJson.flatMap((element) => {
      if (
        element.type === "pcb_missing_footprint_error" ||
        element.type === "external_footprint_load_error" ||
        element.type === "circuit_json_footprint_load_error"
      ) {
        return [element.source_component_id]
      }
      return []
    }),
  )
  const pcbComponentsBySourceComponentId = new Map<string, PcbComponent[]>()

  for (const element of circuitJson) {
    if (element.type !== "pcb_component" || !element.source_component_id) {
      continue
    }

    const components =
      pcbComponentsBySourceComponentId.get(element.source_component_id) ?? []
    components.push(element)
    pcbComponentsBySourceComponentId.set(
      element.source_component_id,
      components,
    )
  }

  const errors: PcbPortNotMatchedError[] = []

  for (const element of circuitJson) {
    if (
      element.type !== "source_port" ||
      !connectedSourcePortIds.has(element.source_port_id) ||
      !element.source_component_id ||
      sourceComponentIdsWithFootprintErrors.has(element.source_component_id)
    ) {
      continue
    }

    const pcbComponents = pcbComponentsBySourceComponentId.get(
      element.source_component_id,
    )
    if (!pcbComponents?.length) continue

    const ownerPcbComponentIds = new Set(
      pcbComponents.map((component) => component.pcb_component_id),
    )
    const hasMatchingPcbPort = pcbPorts.some(
      (pcbPort) =>
        pcbPort.source_port_id === element.source_port_id &&
        pcbPort.pcb_component_id !== undefined &&
        ownerPcbComponentIds.has(pcbPort.pcb_component_id),
    )
    if (hasMatchingPcbPort) continue

    errors.push({
      type: "pcb_port_not_matched_error",
      pcb_error_id: `pcb_port_not_matched_${element.source_port_id}`,
      error_type: "pcb_port_not_matched_error",
      message: `Source port ${getReadableNameForSourcePort(circuitJson, element.source_port_id)} is connected but has no matching PCB port/pad mapping.`,
      pcb_component_ids: pcbComponents.map(
        (component) => component.pcb_component_id,
      ),
      subcircuit_id:
        element.subcircuit_id ?? pcbComponents[0]?.subcircuit_id ?? undefined,
    })
  }

  return errors
}
