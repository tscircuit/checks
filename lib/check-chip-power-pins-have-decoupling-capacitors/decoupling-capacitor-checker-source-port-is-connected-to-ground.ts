import type { SourcePort } from "circuit-json"
import type { DecouplingCapacitorChecker } from "./decoupling-capacitor-checker"

export const sourcePortIsConnectedToGround = (
  checker: DecouplingCapacitorChecker,
  sourcePort: SourcePort,
): boolean =>
  checker.groundSourcePorts.some((groundSourcePort) =>
    checker.sourceConnectivityMap.areIdsConnected(
      sourcePort.source_port_id,
      groundSourcePort.source_port_id,
    ),
  ) ||
  checker.groundSourceNets.some((groundSourceNet) =>
    checker.sourceConnectivityMap.areIdsConnected(
      sourcePort.source_port_id,
      groundSourceNet.source_net_id,
    ),
  )
