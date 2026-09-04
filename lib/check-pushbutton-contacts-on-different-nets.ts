import {
  type AnyCircuitElement,
  type SchematicPort,
  type SourceComponentMisconfiguredError,
  type SourcePort,
  type SourceSimplePushButton,
  source_component_misconfigured_error,
} from "circuit-json"

export function checkPushbuttonContactsOnDifferentNets(
  circuitJson: AnyCircuitElement[],
): SourceComponentMisconfiguredError[] {
  const pushbuttons = circuitJson.filter(
    (element): element is SourceSimplePushButton =>
      element.type === "source_component" &&
      element.ftype === "simple_push_button",
  )
  const sourcePorts = circuitJson.filter(
    (element): element is SourcePort => element.type === "source_port",
  )
  const schematicPorts = circuitJson.filter(
    (element): element is SchematicPort => element.type === "schematic_port",
  )
  const errors: SourceComponentMisconfiguredError[] = []

  for (const pushbutton of pushbuttons) {
    const schematicContactSourcePorts = schematicPorts.flatMap(
      (schematicPort) => {
        const sourcePort = sourcePorts.find(
          (sourcePort) =>
            sourcePort.source_port_id === schematicPort.source_port_id &&
            sourcePort.source_component_id === pushbutton.source_component_id,
        )
        if (!sourcePort) return []
        return [sourcePort]
      },
    )
    if (schematicContactSourcePorts.length !== 2) continue

    const firstContactConnectivityKey =
      schematicContactSourcePorts[0].subcircuit_connectivity_map_key
    const secondContactConnectivityKey =
      schematicContactSourcePorts[1].subcircuit_connectivity_map_key
    if (!firstContactConnectivityKey) continue
    if (firstContactConnectivityKey !== secondContactConnectivityKey) continue

    errors.push(
      source_component_misconfigured_error.parse({
        type: "source_component_misconfigured_error",
        message: `Pushbutton ${pushbutton.name} has both schematic contacts connected to the same net. Check internallyConnectedPins and the footprint pin mapping.`,
        source_component_ids: [pushbutton.source_component_id],
        source_port_ids: schematicContactSourcePorts.map(
          (sourcePort) => sourcePort.source_port_id,
        ),
        is_fatal: true,
      }),
    )
  }

  return errors
}
