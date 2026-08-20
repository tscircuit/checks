import type { AnyCircuitElement, PcbPortNotMatchedError } from "circuit-json"

/**
 * Check that every source port used by a trace on a placed component has a
 * matching PCB port. This catches footprint port-matching failures before the
 * missing endpoint can be mistaken for an intentionally unplaced connection.
 */
export function checkTracedSourcePortsHavePcbPorts(
  circuitJson: AnyCircuitElement[],
): PcbPortNotMatchedError[] {
  const sourceTraces = circuitJson.filter(
    (element) => element.type === "source_trace",
  )
  const sourcePorts = circuitJson.filter(
    (element) => element.type === "source_port",
  )
  const sourceComponents = circuitJson.filter(
    (element) => element.type === "source_component",
  )
  const pcbComponents = circuitJson.filter(
    (element) => element.type === "pcb_component",
  )

  const tracedSourcePortIds = new Set(
    sourceTraces.flatMap((trace) => trace.connected_source_port_ids),
  )
  const matchedSourcePortIds = new Set(
    circuitJson.flatMap((element) =>
      element.type === "pcb_port" ? [element.source_port_id] : [],
    ),
  )
  const sourceComponentById = new Map(
    sourceComponents.map((component) => [
      component.source_component_id,
      component,
    ]),
  )
  const pcbComponentBySourceComponentId = new Map(
    pcbComponents.flatMap((component) =>
      component.source_component_id
        ? [[component.source_component_id, component] as const]
        : [],
    ),
  )

  const errors: PcbPortNotMatchedError[] = []
  for (const sourcePort of sourcePorts) {
    if (!tracedSourcePortIds.has(sourcePort.source_port_id)) continue
    if (matchedSourcePortIds.has(sourcePort.source_port_id)) continue
    if (!sourcePort.source_component_id) continue

    const pcbComponent = pcbComponentBySourceComponentId.get(
      sourcePort.source_component_id,
    )
    if (!pcbComponent) continue

    const sourceComponent = sourceComponentById.get(
      sourcePort.source_component_id,
    )
    const componentName = sourceComponent?.name ?? "component"
    const portName = sourcePort.name ?? `pin${sourcePort.pin_number}`

    errors.push({
      type: "pcb_port_not_matched_error",
      pcb_error_id: `pcb_port_not_matched_${sourcePort.source_port_id}`,
      error_type: "pcb_port_not_matched_error",
      message: `Source port [${componentName}.${portName}] is used by a trace but has no matching PCB port. Check that its footprint pad has a matching port hint.`,
      pcb_component_ids: [pcbComponent.pcb_component_id],
      subcircuit_id: pcbComponent.subcircuit_id,
    })
  }

  return errors
}
