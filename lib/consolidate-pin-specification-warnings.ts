import type {
  AnyCircuitElement,
  SourceComponentPinsUnderspecifiedWarning,
  SourceNoPowerPinDefinedWarning,
  SourceNoGroundPinDefinedWarning,
} from "circuit-json"

type PinWarning =
  | SourceComponentPinsUnderspecifiedWarning
  | SourceNoPowerPinDefinedWarning
  | SourceNoGroundPinDefinedWarning

/** The representative keeps its existing Circuit JSON type. */
export type ConsolidatedPinSpecificationWarning = PinWarning & {
  related_warnings?: PinWarning[]
  is_fatal?: boolean
}

/** Combine missing pin metadata for one component, retaining every reason.
 * Does not combine connectivity errors or mutate inputs. */
export function consolidatePinSpecificationWarnings<
  T extends AnyCircuitElement,
>(
  circuitJson: AnyCircuitElement[],
  warnings: T[],
): (T | ConsolidatedPinSpecificationWarning)[]
export function consolidatePinSpecificationWarnings(
  circuitJson: AnyCircuitElement[],
  warnings: AnyCircuitElement[],
): (AnyCircuitElement | ConsolidatedPinSpecificationWarning)[] {
  const isCandidate = (
    warning: AnyCircuitElement,
  ): warning is ConsolidatedPinSpecificationWarning =>
    warning.type === "source_component_pins_underspecified_warning" ||
    warning.type === "source_no_power_pin_defined_warning" ||
    warning.type === "source_no_ground_pin_defined_warning"
  const raw = warnings.flatMap((warning) =>
    isCandidate(warning) ? (warning.related_warnings ?? [warning]) : [warning],
  )
  const keyFor = (warning: ConsolidatedPinSpecificationWarning) =>
    JSON.stringify([
      warning.source_component_id,
      warning.subcircuit_id,
      warning.is_fatal ?? false,
    ])
  const groups = new Map<string, ConsolidatedPinSpecificationWarning[]>()
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
  return raw.flatMap<AnyCircuitElement | ConsolidatedPinSpecificationWarning>(
    (warning) => {
      if (!isCandidate(warning)) return [warning]
      const key = keyFor(warning)
      const group = groups.get(key)!
      if (new Set(group.map((e) => e.type)).size < 2) return [warning]
      if (emitted.has(key)) return []
      emitted.add(key)
      const reasons = [
        [
          "source_component_pins_underspecified_warning",
          "no pinAttributes set",
        ],
        ["source_no_power_pin_defined_warning", "no requires_power pin"],
        ["source_no_ground_pin_defined_warning", "no requires_ground pin"],
      ]
        .filter(([type]) => group.some((e) => e.type === type))
        .map(([, reason]) => reason)
      // Prefer the general warning when present; otherwise preserve the first
      // applicable power/ground warning rather than inventing underspecification.
      const representative =
        group.find(
          (e) => e.type === "source_component_pins_underspecified_warning",
        ) ?? group[0]!
      return [
        {
          ...representative,
          message: `${names.get(warning.source_component_id) ?? "Component"} has incomplete pin metadata: ${reasons.join("; ")}. Define the applicable pinAttributes.`,
          source_port_ids: [
            ...new Set(group.flatMap((e) => e.source_port_ids ?? [])),
          ],
          related_warnings: group,
        },
      ]
    },
  )
}
