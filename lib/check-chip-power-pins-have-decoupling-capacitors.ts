import { cju } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  SourceComponentBase,
  SourceNet,
  SourcePinMissingTraceWarning,
  SourcePort,
  SourceSimpleCapacitor,
} from "circuit-json"
import { getSourcePortConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"

type SourceComponentId = SourceComponentBase["source_component_id"]
type SourceNetId = SourceNet["source_net_id"]
type SourcePortId = SourcePort["source_port_id"]
type SourceConnectivityId = SourceNetId | SourcePortId

const GROUND_NET_REGEX = /^(GND|AGND|DGND|PGND|VSS)/i
const POWER_NET_REGEX = /^V(?!SS)|^\d+(?:[_.]\d+)?[Vv]/i

interface SourceCircuitRelationships {
  areConnected: (
    firstSourceConnectivityId: SourceConnectivityId,
    secondSourceConnectivityId: SourceConnectivityId,
  ) => boolean
  sourcePortHasConnection: (sourcePortId: SourcePortId) => boolean
  sourcePortIsConnectedToGround: (sourcePort: SourcePort) => boolean
}

const getSourcePortLabels = (sourcePort: SourcePort): string[] => [
  sourcePort.name,
  ...(sourcePort.port_hints ?? []),
]

const getSourcePortDisplayLabel = (sourcePort: SourcePort): string =>
  sourcePort.port_hints?.find(
    (sourcePortHint) => !/^(pin)?\d+$/i.test(sourcePortHint),
  ) ?? sourcePort.name

const sourcePortShouldHaveDecouplingCapacitor = (
  sourcePort: SourcePort,
): boolean => {
  if (sourcePort.should_have_decoupling_capacitor !== undefined) {
    return sourcePort.should_have_decoupling_capacitor
  }
  if (sourcePort.provides_power === true) return false
  if (sourcePort.requires_power !== undefined) return sourcePort.requires_power

  return getSourcePortLabels(sourcePort).some((sourcePortLabel) =>
    POWER_NET_REGEX.test(sourcePortLabel),
  )
}

const sourcePortLooksLikeGround = (sourcePort: SourcePort): boolean =>
  sourcePort.requires_ground === true ||
  sourcePort.provides_ground === true ||
  getSourcePortLabels(sourcePort).some((sourcePortLabel) =>
    GROUND_NET_REGEX.test(sourcePortLabel),
  )

const getSourcePortsBySourceComponentId = (
  sourcePorts: SourcePort[],
): Map<SourceComponentId, SourcePort[]> => {
  const sourcePortsBySourceComponentId = new Map<
    SourceComponentId,
    SourcePort[]
  >()

  for (const sourcePort of sourcePorts) {
    if (!sourcePort.source_component_id) continue
    const componentSourcePorts =
      sourcePortsBySourceComponentId.get(sourcePort.source_component_id) ?? []
    componentSourcePorts.push(sourcePort)
    sourcePortsBySourceComponentId.set(
      sourcePort.source_component_id,
      componentSourcePorts,
    )
  }

  return sourcePortsBySourceComponentId
}

const createSourceCircuitRelationships = (
  circuitJson: AnyCircuitElement[],
  sourcePorts: SourcePort[],
  groundSourceNets: SourceNet[],
): SourceCircuitRelationships => {
  const sourceConnectivityMap =
    getSourcePortConnectivityMapFromCircuitJson(circuitJson)
  const groundSourcePorts = sourcePorts.filter(sourcePortLooksLikeGround)

  const areConnected = (
    firstSourceConnectivityId: SourceConnectivityId,
    secondSourceConnectivityId: SourceConnectivityId,
  ): boolean =>
    sourceConnectivityMap.areIdsConnected(
      firstSourceConnectivityId,
      secondSourceConnectivityId,
    )

  return {
    areConnected,
    sourcePortHasConnection: (sourcePortId) => {
      const connectedNetId =
        sourceConnectivityMap.getNetConnectedToId(sourcePortId)
      if (!connectedNetId) return false
      return sourceConnectivityMap
        .getIdsConnectedToNet(connectedNetId)
        .some((connectedId) => connectedId !== sourcePortId)
    },
    sourcePortIsConnectedToGround: (sourcePort) =>
      groundSourcePorts.some((groundSourcePort) =>
        areConnected(
          sourcePort.source_port_id,
          groundSourcePort.source_port_id,
        ),
      ) ||
      groundSourceNets.some((groundSourceNet) =>
        areConnected(sourcePort.source_port_id, groundSourceNet.source_net_id),
      ),
  }
}

const capacitorConnectsChipPowerSourcePortToGround = ({
  capacitorSourcePorts,
  chipPowerSourcePort,
  sourceCircuitRelationships,
}: {
  capacitorSourcePorts: SourcePort[]
  chipPowerSourcePort: SourcePort
  sourceCircuitRelationships: SourceCircuitRelationships
}): boolean => {
  if (capacitorSourcePorts.length !== 2) return false

  const [firstCapacitorSourcePort, secondCapacitorSourcePort] =
    capacitorSourcePorts
  const capacitorPortsBridgePowerToGround = (
    capacitorPowerSourcePort: SourcePort,
    capacitorGroundSourcePort: SourcePort,
  ): boolean =>
    sourceCircuitRelationships.areConnected(
      chipPowerSourcePort.source_port_id,
      capacitorPowerSourcePort.source_port_id,
    ) &&
    sourceCircuitRelationships.sourcePortIsConnectedToGround(
      capacitorGroundSourcePort,
    )

  return (
    capacitorPortsBridgePowerToGround(
      firstCapacitorSourcePort,
      secondCapacitorSourcePort,
    ) ||
    capacitorPortsBridgePowerToGround(
      secondCapacitorSourcePort,
      firstCapacitorSourcePort,
    )
  )
}

export const checkChipPowerPinsHaveDecouplingCapacitors = (
  circuitJson: AnyCircuitElement[],
): SourcePinMissingTraceWarning[] => {
  const db = cju(circuitJson)
  const sourceComponents = db.source_component.list() as SourceComponentBase[]
  const sourcePorts = db.source_port.list() as SourcePort[]
  const sourcePortsBySourceComponentId =
    getSourcePortsBySourceComponentId(sourcePorts)
  const sourceCircuitRelationships = createSourceCircuitRelationships(
    circuitJson,
    sourcePorts,
    db.source_net.list() as SourceNet[],
  )
  const capacitorSourceComponents = sourceComponents.filter(
    (sourceComponent): sourceComponent is SourceSimpleCapacitor =>
      sourceComponent.ftype === "simple_capacitor",
  )
  const warnings: SourcePinMissingTraceWarning[] = []

  for (const chipSourceComponent of sourceComponents) {
    if (chipSourceComponent.ftype !== "simple_chip") continue

    const chipSourcePorts =
      sourcePortsBySourceComponentId.get(
        chipSourceComponent.source_component_id,
      ) ?? []

    for (const chipSourcePort of chipSourcePorts) {
      if (!sourcePortShouldHaveDecouplingCapacitor(chipSourcePort)) continue
      if (
        !sourceCircuitRelationships.sourcePortHasConnection(
          chipSourcePort.source_port_id,
        )
      ) {
        continue
      }

      const hasDecouplingCapacitor = capacitorSourceComponents.some(
        (capacitorSourceComponent) =>
          capacitorConnectsChipPowerSourcePortToGround({
            capacitorSourcePorts:
              sourcePortsBySourceComponentId.get(
                capacitorSourceComponent.source_component_id,
              ) ?? [],
            chipPowerSourcePort: chipSourcePort,
            sourceCircuitRelationships,
          }),
      )
      if (hasDecouplingCapacitor) continue

      const recommendedCapacitance =
        chipSourcePort.recommended_decoupling_capacitor_capacitance
      const capacitanceDescription =
        recommendedCapacitance === undefined ? "" : ` ${recommendedCapacitance}`

      warnings.push({
        type: "source_pin_missing_trace_warning",
        source_pin_missing_trace_warning_id: `source_pin_missing_trace_warning_decoupling_${chipSourcePort.source_port_id}`,
        warning_type: "source_pin_missing_trace_warning",
        message: `Power pin ${getSourcePortDisplayLabel(chipSourcePort)} on ${chipSourceComponent.name} should have a${capacitanceDescription} decoupling capacitor connected to ground`,
        source_component_id: chipSourceComponent.source_component_id,
        source_port_id: chipSourcePort.source_port_id,
        subcircuit_id: chipSourcePort.subcircuit_id,
      })
    }
  }

  return warnings
}
