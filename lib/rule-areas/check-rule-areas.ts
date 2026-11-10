import type { AnyCircuitElement } from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { RuleAreaManager } from "./rule-area-manager"
import type { RuleAreaDiagnostic, RuleAreaInput } from "./types"

export function checkRuleAreas(
  circuitJson: AnyCircuitElement[],
  options: {
    ruleAreas?: RuleAreaInput[]
    connMap?: ConnectivityMap
  } = {},
): RuleAreaDiagnostic[] {
  const manager = new RuleAreaManager(circuitJson, options)
  return manager.checkRuleAreas()
}
