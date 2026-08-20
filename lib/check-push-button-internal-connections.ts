import type {
  AnyCircuitElement,
  SourceComponentInternalConnection,
  SourceComponentMisconfiguredError,
  SourcePort,
  SourceSimplePushButton,
} from "circuit-json"

/**
 * Four-terminal pushbuttons require two declared internally-connected pin
 * groups so netlist checks can validate the package topology.
 */
export const checkPushButtonInternalConnections = (
  circuitJson: AnyCircuitElement[],
): SourceComponentMisconfiguredError[] => {
  const pushButtons = circuitJson.filter(
    (element): element is SourceSimplePushButton =>
      element.type === "source_component" &&
      element.ftype === "simple_push_button",
  )
  const sourcePorts = circuitJson.filter(
    (element): element is SourcePort => element.type === "source_port",
  )
  const internalConnections = circuitJson.filter(
    (element): element is SourceComponentInternalConnection =>
      element.type === "source_component_internal_connection",
  )

  const errors: SourceComponentMisconfiguredError[] = []

  for (const pushButton of pushButtons) {
    const pushButtonPorts = sourcePorts.filter(
      (sourcePort) =>
        sourcePort.source_component_id === pushButton.source_component_id,
    )
    if (pushButtonPorts.length <= 2) continue

    const componentGroups =
      pushButton.internally_connected_source_port_ids ?? []
    const declaredGroups =
      componentGroups.length > 0
        ? componentGroups
        : internalConnections
            .filter(
              (connection) =>
                connection.source_component_id ===
                pushButton.source_component_id,
            )
            .map((connection) => connection.source_port_ids)
    const declaredPortIds = new Set(declaredGroups.flat())
    const hasCompletePairTopology =
      declaredGroups.length === 2 &&
      declaredGroups.every((group) => group.length === 2) &&
      pushButtonPorts.every((port) => declaredPortIds.has(port.source_port_id))

    if (hasCompletePairTopology) continue

    errors.push({
      type: "source_component_misconfigured_error",
      source_component_misconfigured_error_id: `push_button_internal_connections_${pushButton.source_component_id}`,
      error_type: "source_component_misconfigured_error",
      message: `Pushbutton ${pushButton.name} has ${pushButtonPorts.length} pins but does not declare two internally-connected pin pairs`,
      source_component_ids: [pushButton.source_component_id],
      source_port_ids: pushButtonPorts.map((port) => port.source_port_id),
    })
  }

  return errors
}
