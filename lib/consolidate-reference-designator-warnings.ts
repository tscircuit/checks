import type {
  AnyCircuitElement,
  SchematicComponentStylingWarning,
} from "circuit-json"

/** Checks-specific context; related_warnings retains each original location. */
export interface ConsolidatedReferenceDesignatorWarning
  extends SchematicComponentStylingWarning {
  schematic_component_ids?: string[]
  source_component_ids?: string[]
  related_warnings?: SchematicComponentStylingWarning[]
  is_fatal?: boolean
}

/** Group only the same warning rule in the same scope. Other diagnostics and
 * singletons are untouched. Inputs are not mutated; repeated calls are safe. */
export function consolidateReferenceDesignatorWarnings<
  T extends AnyCircuitElement,
>(
  circuitJson: AnyCircuitElement[],
  warnings: T[],
): (T | ConsolidatedReferenceDesignatorWarning)[]
export function consolidateReferenceDesignatorWarnings(
  circuitJson: AnyCircuitElement[],
  warnings: AnyCircuitElement[],
): (AnyCircuitElement | ConsolidatedReferenceDesignatorWarning)[] {
  const isCandidate = (
    warning: AnyCircuitElement,
  ): warning is ConsolidatedReferenceDesignatorWarning =>
    warning.type === "schematic_component_styling_warning" &&
    warning.styling_issue_type === "missing_reference_designator_text"
  const raw = warnings.flatMap((warning) =>
    isCandidate(warning) ? (warning.related_warnings ?? [warning]) : [warning],
  )
  const groups = new Map<string, ConsolidatedReferenceDesignatorWarning[]>()
  const keyFor = (warning: ConsolidatedReferenceDesignatorWarning) =>
    JSON.stringify([
      warning.subcircuit_id,
      warning.schematic_sheet_id,
      warning.is_fatal ?? false,
    ])
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
  return raw.flatMap<
    AnyCircuitElement | ConsolidatedReferenceDesignatorWarning
  >((warning) => {
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
          (e) => names.get(e.source_component_id ?? "") ?? "unnamed component",
        )
        .join(", ") + (group.length > 3 ? `, +${group.length - 3} more` : "")
    return [
      {
        ...group[0],
        schematic_component_styling_warning_id: `consolidated_schematic_component_styling_warning_${encodeURIComponent(key)}`,
        message: `${group.length} components are missing schematic reference designator text (${label}). For a custom symbol, add name="{REFDES}" inside the symbol.`,
        schematic_component_ids: [
          ...new Set(group.map((e) => e.schematic_component_id)),
        ],
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
  })
}
