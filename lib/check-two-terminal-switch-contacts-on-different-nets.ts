import {
  type AnyCircuitElement,
  type SchematicPort,
  type SourceComponentMisconfiguredError,
  type SourcePort,
  type SourceSimplePushButton,
  type SourceSimpleSwitch,
  source_component_misconfigured_error,
} from "circuit-json"

type SwitchingComponent = SourceSimplePushButton | SourceSimpleSwitch

export function checkTwoTerminalSwitchContactsOnDifferentNets(
  circuitJson: AnyCircuitElement[],
): SourceComponentMisconfiguredError[] {
  const switchingComponents = circuitJson.filter(
    (element): element is SwitchingComponent =>
      element.type === "source_component" &&
      (element.ftype === "simple_push_button" ||
        element.ftype === "simple_switch"),
  )
  const sourcePorts = circuitJson.filter(
    (element): element is SourcePort => element.type === "source_port",
  )
  const schematicPorts = circuitJson.filter(
    (element): element is SchematicPort => element.type === "schematic_port",
  )
  const errors: SourceComponentMisconfiguredError[] = []

  for (const switchingComponent of switchingComponents) {
    const schematicContactSourcePorts = schematicPorts.flatMap(
      (schematicPort) => {
        const sourcePort = sourcePorts.find(
          (sourcePort) =>
            sourcePort.source_port_id === schematicPort.source_port_id &&
            sourcePort.source_component_id ===
              switchingComponent.source_component_id,
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
        message: `Switch ${switchingComponent.name} has both schematic contacts connected to the same net. Check internallyConnectedPins and the footprint pin mapping.`,
        source_component_ids: [switchingComponent.source_component_id],
        source_port_ids: schematicContactSourcePorts.map(
          (sourcePort) => sourcePort.source_port_id,
        ),
        is_fatal: true,
      }),
    )
  }

  return errors
}
