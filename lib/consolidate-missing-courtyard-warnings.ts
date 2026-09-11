import type {
  AnyCircuitElement,
  PcbComponentMissingCourtyardWarning,
} from "circuit-json"

/** Checks-specific context; related_warnings retains each original location. */
export interface ConsolidatedMissingCourtyardWarning
  extends PcbComponentMissingCourtyardWarning {
  pcb_component_ids?: string[]
  source_component_ids?: string[]
  related_warnings?: PcbComponentMissingCourtyardWarning[]
  is_fatal?: boolean
}

/** Group only the same warning rule in the same scope. Other diagnostics and
 * singletons are untouched. Inputs are not mutated; repeated calls are safe. */
export function consolidateMissingCourtyardWarnings<
  T extends AnyCircuitElement,
>(
  circuitJson: AnyCircuitElement[],
  warnings: T[],
): (T | ConsolidatedMissingCourtyardWarning)[]
export function consolidateMissingCourtyardWarnings(
  circuitJson: AnyCircuitElement[],
  warnings: AnyCircuitElement[],
): (AnyCircuitElement | ConsolidatedMissingCourtyardWarning)[] {
  const isCandidate = (
    warning: AnyCircuitElement,
  ): warning is ConsolidatedMissingCourtyardWarning =>
    warning.type === "pcb_component_missing_courtyard_warning"
  const raw = warnings.flatMap((warning) =>
    isCandidate(warning) ? (warning.related_warnings ?? [warning]) : [warning],
  )
  const groups = new Map<string, ConsolidatedMissingCourtyardWarning[]>()
  const keyFor = (warning: ConsolidatedMissingCourtyardWarning) =>
    JSON.stringify([warning.subcircuit_id, warning.is_fatal ?? false])
  for (const warning of raw) {
    if (!isCandidate(warning)) continue
    const key = keyFor(warning)
    const group = groups.get(key) ?? []
    group.push(warning)
    groups.set(key, group)
  }
  const names = new Map(
    circuitJson
      .filter((e) => e.type === "source_component")
      .map((e) => [e.source_component_id, e.name]),
  )
  const emitted = new Set<string>()
  return raw.flatMap<AnyCircuitElement | ConsolidatedMissingCourtyardWarning>(
    (warning) => {
      if (!isCandidate(warning)) return [warning]
      const key = keyFor(warning)
      const group = groups.get(key)!
      if (group.length < 2) return [warning]
      if (emitted.has(key)) return []
      emitted.add(key)
      const label =
        group
          .slice(0, 3)
          .map(
            (e) =>
              names.get(e.source_component_id ?? "") ?? "unnamed component",
          )
          .join(", ") + (group.length > 3 ? `, +${group.length - 3} more` : "")
      return [
        {
          ...group[0],
          pcb_component_missing_courtyard_warning_id: `consolidated_pcb_component_missing_courtyard_warning_${encodeURIComponent(key)}`,
          message: `${group.length} components have no courtyard (${label}). Add courtyard geometry to their footprints.`,
          pcb_component_ids: [...new Set(group.map((e) => e.pcb_component_id))],
          source_component_ids: [
            ...new Set(
              group.flatMap((e) =>
                e.source_component_id ? [e.source_component_id] : [],
              ),
            ),
          ],
          related_warnings: group,
        },
      ]
    },
  )
}
