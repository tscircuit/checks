import type { SourcePort, SourceSimpleCapacitor } from "circuit-json"
import type { DecouplingCapacitorChecker } from "./decoupling-capacitor-checker"

export const DecouplingCapacitorChecker_capacitorConnectsPowerSourcePortToGround =
  (
    checker: DecouplingCapacitorChecker,
    capacitorSourceComponent: SourceSimpleCapacitor,
    chipPowerSourcePort: SourcePort,
  ): boolean => {
    const capacitorSourcePorts = checker.getSourcePorts(
      capacitorSourceComponent.source_component_id,
    )
    if (capacitorSourcePorts.length !== 2) return false

    const [firstCapacitorSourcePort, secondCapacitorSourcePort] =
      capacitorSourcePorts
    return (
      (checker.sourceConnectivityMap.areIdsConnected(
        chipPowerSourcePort.source_port_id,
        firstCapacitorSourcePort.source_port_id,
      ) &&
        checker.sourcePortIsConnectedToGround(secondCapacitorSourcePort)) ||
      (checker.sourceConnectivityMap.areIdsConnected(
        chipPowerSourcePort.source_port_id,
        secondCapacitorSourcePort.source_port_id,
      ) &&
        checker.sourcePortIsConnectedToGround(firstCapacitorSourcePort))
    )
  }
