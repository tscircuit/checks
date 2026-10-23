import {
  type AnyCircuitElement,
  type SourceComponentMisconfiguredError,
  type SourcePort,
  type SourceSimplePushButton,
  type SourceSimpleSwitch,
  source_component_misconfigured_error,
} from "circuit-json"

import { getSourcePortConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { getReadableNameForElementId } from "./util/get-readable-names"

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
  const schematicSourcePortIds = new Set(
    circuitJson.flatMap((element) =>
      element.type === "schematic_port" ? [element.source_port_id] : [],
    ),
  )
  const internalConnectivity = getSourcePortConnectivityMapFromCircuitJson(
    circuitJson.filter(
      (element) =>
        element.type === "source_component" ||
        element.type === "source_component_internal_connection",
    ),
  )
  const connectivity = getSourcePortConnectivityMapFromCircuitJson(circuitJson)
  const portsByConnectivityKey = new Map<string, string[]>()
  for (const port of sourcePorts) {
    if (!port.subcircuit_connectivity_map_key) continue
    const key = JSON.stringify([
      port.subcircuit_id,
      port.subcircuit_connectivity_map_key,
    ])
    const ports = portsByConnectivityKey.get(key) ?? []
    ports.push(port.source_port_id)
    portsByConnectivityKey.set(key, ports)
  }
  connectivity.addConnections([...portsByConnectivityKey.values()])
  const errors: SourceComponentMisconfiguredError[] = []

  for (const switchingComponent of switchingComponents) {
    const schematicSourcePorts = sourcePorts.filter(
      (port) =>
        port.source_component_id === switchingComponent.source_component_id &&
        schematicSourcePortIds.has(port.source_port_id),
    )
    const schematicContactSourcePorts =
      schematicSourcePorts.length === 2
        ? schematicSourcePorts
        : [
            ...new Map(
              schematicSourcePorts.map((port) => [
                internalConnectivity.getNetConnectedToId(port.source_port_id) ??
                  port.source_port_id,
                port,
              ]),
            ).values(),
          ]
    if (schematicContactSourcePorts.length !== 2) continue

    if (
      !connectivity.areIdsConnected(
        schematicContactSourcePorts[0].source_port_id,
        schematicContactSourcePorts[1].source_port_id,
      )
    )
      continue

    errors.push(
      source_component_misconfigured_error.parse({
        type: "source_component_misconfigured_error",
        message: `Switch ${getReadableNameForElementId(circuitJson, switchingComponent.source_component_id)} has both schematic contacts connected to the same net. Check internallyConnectedPins and the footprint pin mapping.`,
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
