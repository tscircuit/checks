import type { AnyCircuitElement } from "circuit-json"

type SourceComponent = Extract<
  AnyCircuitElement,
  { source_component_id: string; name: string }
>

type SourcePort = Extract<AnyCircuitElement, { type: "source_port" }>
type SourceTrace = Extract<AnyCircuitElement, { type: "source_trace" }>

type SourcePinMustBeConnectedError = {
  type: "source_pin_must_be_connected_error"
  source_pin_must_be_connected_error_id: string
  error_type: "source_pin_must_be_connected_error"
  message: string
  source_component_id: string
  source_port_id: string
  subcircuit_id?: string
}

/**
 * Check that each source port with must_be_connected attribute is actually
 * connected to a trace. Returns errors for any pins that are marked as
 * must_be_connected but are floating (not connected to any trace).
 */
export function checkPinMustBeConnected(
  circuitJson: AnyCircuitElement[],
): SourcePinMustBeConnectedError[] {
  const errors: SourcePinMustBeConnectedError[] = []

  // Get all source components, ports, and traces
  const sourceComponents = circuitJson.filter(
    (el): el is SourceComponent =>
      "source_component_id" in el &&
      (el.type === "source_component" || el.type.startsWith("source_simple_")),
  )
  const sourcePorts = circuitJson.filter(
    (el): el is SourcePort => el.type === "source_port",
  )
  const sourceTraces = circuitJson.filter(
    (el): el is SourceTrace => el.type === "source_trace",
  )

  // Build a set of connected source port IDs
  const connectedPortIds = new Set<string>()
  for (const trace of sourceTraces) {
    for (const portId of trace.connected_source_port_ids ?? []) {
      connectedPortIds.add(portId)
    }
  }

  // Build a map of internally connected port groups for each component
  const componentInternalConnections = new Map<string, string[][]>()
  for (const component of sourceComponents) {
    if (
      "internally_connected_source_port_ids" in component &&
      component.internally_connected_source_port_ids
    ) {
      componentInternalConnections.set(
        component.source_component_id,
        component.internally_connected_source_port_ids,
      )
    }
  }

  // For each internal group, if any port is connected, mark all ports in the group as connected
  for (const internalGroups of componentInternalConnections.values()) {
    for (const group of internalGroups) {
      if (group.some((portId) => connectedPortIds.has(portId))) {
        for (const portId of group) {
          connectedPortIds.add(portId)
        }
      }
    }
  }

  // Check each port for must_be_connected attribute
  for (const port of sourcePorts) {
    if (port.must_be_connected === true) {
      if (!connectedPortIds.has(port.source_port_id)) {
        const component = sourceComponents.find(
          (c) => c.source_component_id === port.source_component_id,
        )
        const componentName = component?.name ?? "Unknown"

        errors.push({
          type: "source_pin_must_be_connected_error",
          source_pin_must_be_connected_error_id: `source_pin_must_be_connected_error_${port.source_port_id}`,
          error_type: "source_pin_must_be_connected_error",
          message: `Port ${port.name} on ${componentName} must be connected but is floating`,
          source_component_id: port.source_component_id ?? "",
          source_port_id: port.source_port_id,
          subcircuit_id: port.subcircuit_id,
        })
      }
    }
  }

  return errors
}
