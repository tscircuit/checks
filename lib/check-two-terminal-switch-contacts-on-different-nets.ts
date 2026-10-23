import {
  type AnyCircuitElement,
  type SourceComponentMisconfiguredError,
  type SourcePort,
  type SourceSimplePushButton,
  type SourceSimpleSwitch,
  source_component_misconfigured_error,
} from "circuit-json"
import { getSourcePortConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { getSwitchShortDiagnostic } from "./get-switch-short-diagnostic"

type SwitchingComponent = SourceSimplePushButton | SourceSimpleSwitch
type SubcircuitConnectivityKey = string
type SourcePortId = SourcePort["source_port_id"]

export function checkTwoTerminalSwitchContactsOnDifferentNets(
  circuitJson: AnyCircuitElement[],
): SourceComponentMisconfiguredError[] {
  const switchingComponents = circuitJson.filter(
    (element): element is SwitchingComponent =>
      element.type === "source_component" &&
      (element.ftype === "simple_push_button" ||
        element.ftype === "simple_switch"),
  )
  if (switchingComponents.length === 0) return []

  const sourcePorts = circuitJson.filter(
    (element): element is SourcePort => element.type === "source_port",
  )
  const schematicSourcePortIds = new Set<SourcePortId>()
  for (const element of circuitJson) {
    if (element.type !== "schematic_port") continue
    schematicSourcePortIds.add(element.source_port_id)
  }
  const internalConnectivity = getSourcePortConnectivityMapFromCircuitJson(
    circuitJson.filter(
      (element) =>
        element.type === "source_component" ||
        element.type === "source_component_internal_connection",
    ),
  )
  const externalConnectivity = getSourcePortConnectivityMapFromCircuitJson(
    circuitJson.filter((element) => element.type === "source_trace"),
  )
  const connectivity = getSourcePortConnectivityMapFromCircuitJson(circuitJson)
  const sourcePortIdsByConnectivityKey = new Map<
    SubcircuitConnectivityKey,
    SourcePortId[]
  >()
  for (const port of sourcePorts) {
    if (!port.subcircuit_connectivity_map_key) continue
    const subcircuitConnectivityKey = JSON.stringify([
      port.subcircuit_id,
      port.subcircuit_connectivity_map_key,
    ])
    let sourcePortIds = sourcePortIdsByConnectivityKey.get(
      subcircuitConnectivityKey,
    )
    if (!sourcePortIds) {
      sourcePortIds = []
      sourcePortIdsByConnectivityKey.set(
        subcircuitConnectivityKey,
        sourcePortIds,
      )
    }
    sourcePortIds.push(port.source_port_id)
  }
  connectivity.addConnections([...sourcePortIdsByConnectivityKey.values()])
  const errors: SourceComponentMisconfiguredError[] = []

  for (const switchingComponent of switchingComponents) {
    const schematicSourcePorts = sourcePorts.filter(
      (port) =>
        port.source_component_id === switchingComponent.source_component_id &&
        schematicSourcePortIds.has(port.source_port_id),
    )
    let schematicContactSourcePorts = schematicSourcePorts
    if (schematicSourcePorts.length > 2) {
      schematicContactSourcePorts = []
      const internalContactIds = new Set<string>()
      for (const sourcePort of schematicSourcePorts) {
        const internalContactId =
          internalConnectivity.getNetConnectedToId(sourcePort.source_port_id) ??
          sourcePort.source_port_id
        if (internalContactIds.has(internalContactId)) continue
        internalContactIds.add(internalContactId)
        schematicContactSourcePorts.push(sourcePort)
      }
    }
    if (schematicContactSourcePorts.length !== 2) continue

    const [firstContact, secondContact] = schematicContactSourcePorts
    const contactsAreConnected = connectivity.areIdsConnected(
      firstContact.source_port_id,
      secondContact.source_port_id,
    )
    if (!contactsAreConnected) continue

    const diagnostic = getSwitchShortDiagnostic(switchingComponent, {
      circuitJson,
      sourcePorts,
      contacts: schematicContactSourcePorts,
      internalConnectivity,
      externalConnectivity,
    })

    errors.push(
      source_component_misconfigured_error.parse({
        type: "source_component_misconfigured_error",
        ...diagnostic,
        source_component_ids: [switchingComponent.source_component_id],
        is_fatal: true,
      }),
    )
  }

  return errors
}
