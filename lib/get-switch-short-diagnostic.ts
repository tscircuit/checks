import type {
  AnyCircuitElement,
  SourcePort,
  SourceSimplePushButton,
  SourceSimpleSwitch,
} from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import {
  getReadableNameForElementId,
  getReadableNameForSourcePort,
} from "./util/get-readable-names"

type SwitchDiagnosticContext = {
  circuitJson: AnyCircuitElement[]
  sourcePorts: SourcePort[]
  contacts: SourcePort[]
  internalConnectivity: ConnectivityMap
  externalConnectivity: ConnectivityMap
}

export function getSwitchShortDiagnostic(
  switchingComponent: SourceSimplePushButton | SourceSimpleSwitch,
  ctx: SwitchDiagnosticContext,
) {
  const { circuitJson, internalConnectivity, externalConnectivity } = ctx
  const switchName = getReadableNameForElementId(
    circuitJson,
    switchingComponent.source_component_id,
  )
  const sourceNets = circuitJson.filter(
    (element) => element.type === "source_net",
  )
  const switchPorts = ctx.sourcePorts.filter(
    (port) =>
      port.source_component_id === switchingComponent.source_component_id,
  )

  for (const firstPort of switchPorts) {
    const firstNet = sourceNets.find((net) =>
      externalConnectivity.areIdsConnected(
        firstPort.source_port_id,
        net.source_net_id,
      ),
    )
    if (!firstNet) continue

    for (const secondPort of switchPorts) {
      if (
        !internalConnectivity.areIdsConnected(
          firstPort.source_port_id,
          secondPort.source_port_id,
        )
      )
        continue
      if (
        externalConnectivity.areIdsConnected(
          firstPort.source_port_id,
          secondPort.source_port_id,
        )
      )
        continue
      const secondNet = sourceNets.find((net) =>
        externalConnectivity.areIdsConnected(
          secondPort.source_port_id,
          net.source_net_id,
        ),
      )
      if (!secondNet) continue

      const firstPinName = getReadableNameForSourcePort(circuitJson, firstPort)
      const secondPinName = getReadableNameForSourcePort(
        circuitJson,
        secondPort,
      )
      const firstNetName = getReadableNameForElementId(
        circuitJson,
        firstNet.source_net_id,
      )
      const secondNetName = getReadableNameForElementId(
        circuitJson,
        secondNet.source_net_id,
      )
      return {
        message: `${switchName}: ${firstPinName} (${firstNetName}) and ${secondPinName} (${secondNetName}) are declared internally connected, joining ${firstNetName} to ${secondNetName}. Check the pin connections and footprint mapping.`,
        source_port_ids: [firstPort.source_port_id, secondPort.source_port_id],
      }
    }
  }

  const contactNames = ctx.contacts.map((port) =>
    getReadableNameForSourcePort(circuitJson, port),
  )
  return {
    message: `${switchName}: contacts ${contactNames.join(" and ")} are electrically connected. Check the wiring and internal pin mapping; the two switch contacts must be on separate nets.`,
    source_port_ids: ctx.contacts.map((port) => port.source_port_id),
  }
}
