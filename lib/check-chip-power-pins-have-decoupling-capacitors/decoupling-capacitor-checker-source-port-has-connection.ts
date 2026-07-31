import type { SourcePort } from "circuit-json"
import type { DecouplingCapacitorChecker } from "./decoupling-capacitor-checker"

export const sourcePortHasConnection = (
  checker: DecouplingCapacitorChecker,
  sourcePort: SourcePort,
): boolean => {
  const connectedNetId = checker.sourceConnectivityMap.getNetConnectedToId(
    sourcePort.source_port_id,
  )
  if (!connectedNetId) return false
  return checker.sourceConnectivityMap
    .getIdsConnectedToNet(connectedNetId)
    .some((connectedId) => connectedId !== sourcePort.source_port_id)
}
