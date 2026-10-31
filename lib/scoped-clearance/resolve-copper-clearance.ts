import type {
  LayerRef,
  PcbClearanceCopperKind,
  PcbClearanceRule,
  PcbClearanceScope,
} from "circuit-json"

export interface ClearanceCopper {
  netIds: readonly string[]
  layer: LayerRef
  kind: PcbClearanceCopperKind
  componentName?: string
  isKeepout: boolean
  inPolygon: boolean
  isFree: boolean
}

type Match = boolean | undefined

function all(matches: Match[]): Match {
  if (matches.includes(false)) return false
  return matches.includes(undefined) ? undefined : true
}

function any(matches: Match[]): Match {
  if (matches.includes(true)) return true
  return matches.includes(undefined) ? undefined : false
}

/** Undefined means unknown, never a non-match. Boolean guards can prove false. */
export function matchesClearanceScope(
  scope: PcbClearanceScope,
  copper: ClearanceCopper,
): Match {
  switch (scope.type) {
    case "all":
      return true
    case "net":
      return scope.net_ids.some((id) => copper.netIds.includes(id))
    case "layer":
      return scope.layers.includes(copper.layer)
    case "kind":
      return scope.kinds.includes(copper.kind)
    case "component":
      return copper.componentName === undefined
        ? false
        : scope.component_names.includes(copper.componentName)
    case "property":
      switch (scope.property) {
        case "has_net":
          return copper.netIds.length > 0
        case "is_keepout":
          return copper.isKeepout
        case "in_polygon":
          return copper.inPolygon
        case "is_free":
          return copper.isFree
      }
    case "not": {
      const value = matchesClearanceScope(scope.scope, copper)
      return value === undefined ? undefined : !value
    }
    case "and":
      return all(
        scope.scopes.map((child) => matchesClearanceScope(child, copper)),
      )
    case "or":
      return any(
        scope.scopes.map((child) => matchesClearanceScope(child, copper)),
      )
    case "unsupported":
      return undefined
  }
}

export class UnverifiedClearanceRuleError extends Error {
  constructor(
    public readonly ruleName: string,
    reason: string,
  ) {
    super(`Cannot verify clearance rule ${ruleName}: ${reason}`)
  }
}

/** Select by source priority, testing the unordered copper pair both ways. */
export function resolveCopperClearance(
  rules: readonly PcbClearanceRule[],
  first: ClearanceCopper,
  second: ClearanceCopper,
): PcbClearanceRule | undefined {
  if (first.layer !== second.layer) return undefined
  const ordered = rules
    .filter((rule) => rule.enabled)
    .toSorted((a, b) => a.priority - b.priority)
  let selected: PcbClearanceRule | undefined
  for (const rule of ordered) {
    if (selected && rule.priority > selected.priority) break
    const match = any([
      all([
        matchesClearanceScope(rule.scope1, first),
        matchesClearanceScope(rule.scope2, second),
      ]),
      all([
        matchesClearanceScope(rule.scope1, second),
        matchesClearanceScope(rule.scope2, first),
      ]),
    ])
    if (match === undefined)
      throw new UnverifiedClearanceRuleError(
        rule.name,
        "its source selector is unsupported",
      )
    if (!match) continue
    if (selected && selected.clearance !== rule.clearance) {
      throw new UnverifiedClearanceRuleError(
        rule.name,
        "matching rules have equal priority and different clearances",
      )
    }
    selected = rule
  }
  return selected
}
