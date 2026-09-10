import { getPrimaryId } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PcbFootprintOverlapError,
  PcbPadPadClearanceError,
  PcbCourtyardOverlapError,
} from "circuit-json"

/** Additional diagnostic context supplied by checks; the base error remains
 * compatible with existing Circuit JSON renderers. */
export interface PcbComponentOverlapError extends PcbFootprintOverlapError {
  pcb_component_ids?: string[]
  related_errors?: PlacementOverlapError[]
}

type PlacementOverlapError =
  | PcbComponentOverlapError
  | PcbPadPadClearanceError
  | PcbCourtyardOverlapError

/**
 * Consolidate placement conflicts for the same exact pair of components, only
 * when a footprint overlap was detected. Keep raw details and all affected
 * pad/hole IDs on one renderer-compatible error. Unrelated checks, standalone
 * elements, same-component clearance errors and clearance-only pairs survive.
 * Does not mutate inputs; safe to apply again when combining check runners.
 */
export function consolidatePcbOverlapErrors<T extends AnyCircuitElement>(
  circuitJson: AnyCircuitElement[],
  errors: T[],
): (T | PcbComponentOverlapError)[]
export function consolidatePcbOverlapErrors(
  circuitJson: AnyCircuitElement[],
  errors: AnyCircuitElement[],
): AnyCircuitElement[] {
  const ownerByElementId = new Map<string, string>()
  const elementById = new Map<string, AnyCircuitElement>()
  for (const element of circuitJson) {
    const id = getPrimaryId(element)
    elementById.set(id, element)
    if ("pcb_component_id" in element && element.pcb_component_id) {
      ownerByElementId.set(id, element.pcb_component_id)
    }
  }

  const rawErrors = errors.flatMap<AnyCircuitElement>((error) =>
    error.type === "pcb_footprint_overlap_error"
      ? ((error as PcbComponentOverlapError).related_errors ?? [error])
      : [error],
  )
  const groups = new Map<string, PlacementOverlapError[]>()
  const keyByError = new Map<AnyCircuitElement, string>()
  for (const error of rawErrors) {
    let componentIds: string[]
    if (error.type === "pcb_footprint_overlap_error") {
      // Keepout errors describe a different constraint, even if pads are named.
      if (error.pcb_keepout_ids?.length) continue
      const overlap = error as PcbComponentOverlapError
      const elementIds = [
        ...(error.pcb_smtpad_ids ?? []),
        ...(error.pcb_plated_hole_ids ?? []),
        ...(error.pcb_hole_ids ?? []),
      ]
      if (elementIds.some((id) => !ownerByElementId.has(id))) continue
      componentIds =
        overlap.pcb_component_ids ??
        elementIds.map((id) => ownerByElementId.get(id)!)
    } else if (error.type === "pcb_pad_pad_clearance_error") {
      if (error.pcb_pad_ids.some((id) => !ownerByElementId.has(id))) continue
      componentIds = error.pcb_pad_ids.map((id) => ownerByElementId.get(id)!)
    } else if (error.type === "pcb_courtyard_overlap_error") {
      componentIds = error.pcb_component_ids
    } else {
      continue
    }
    componentIds = [...new Set(componentIds)].sort()
    if (componentIds.length !== 2) continue
    const key = JSON.stringify(componentIds)
    keyByError.set(error, key)
    const group = groups.get(key) ?? []
    group.push(error)
    groups.set(key, group)
  }

  const summaries = new Map<string, PcbComponentOverlapError>()
  for (const [key, group] of groups) {
    const overlaps = group.filter(
      (e) => e.type === "pcb_footprint_overlap_error",
    )
    if (group.length < 2 || overlaps.length === 0) continue
    const componentIds: string[] = JSON.parse(key)
    const names = componentIds.map((id) => {
      const component = elementById.get(id)
      const source =
        component?.type === "pcb_component"
          ? elementById.get(component.source_component_id)
          : undefined
      return source?.type === "source_component" ? source.name : id
    })
    const counts = [
      [overlaps.length, "footprint overlap"],
      [
        group.filter((e) => e.type === "pcb_pad_pad_clearance_error").length,
        "pad clearance violation",
      ],
      [
        group.filter((e) => e.type === "pcb_courtyard_overlap_error").length,
        "courtyard conflict",
      ],
    ] as const
    const details = counts
      .filter(([count]) => count > 0)
      .map(([count, label]) => `${count} ${label}${count === 1 ? "" : "s"}`)
    const summary: PcbComponentOverlapError = {
      type: "pcb_footprint_overlap_error",
      error_type: "pcb_footprint_overlap_error",
      pcb_error_id: `pcb_component_overlap_${componentIds.join("_")}`,
      pcb_component_ids: componentIds,
      message: `${names.join(" overlaps ")}: ${details.join(", ")}. Move the components apart.`,
      related_errors: group,
    }
    if (group.some((error) => error.is_fatal)) summary.is_fatal = true
    const affectedIds = new Set<string>()
    for (const error of group) {
      if (error.type === "pcb_footprint_overlap_error") {
        for (const id of [
          ...(error.pcb_smtpad_ids ?? []),
          ...(error.pcb_plated_hole_ids ?? []),
          ...(error.pcb_hole_ids ?? []),
        ])
          affectedIds.add(id)
      } else if (error.type === "pcb_pad_pad_clearance_error") {
        for (const id of error.pcb_pad_ids) affectedIds.add(id)
      }
    }
    for (const [field, type] of [
      ["pcb_smtpad_ids", "pcb_smtpad"],
      ["pcb_plated_hole_ids", "pcb_plated_hole"],
      ["pcb_hole_ids", "pcb_hole"],
    ] as const) {
      const ids = [...affectedIds]
        .filter((id) => elementById.get(id)?.type === type)
        .sort()
      if (ids.length) summary[field] = ids
    }
    summaries.set(key, summary)
  }

  const emitted = new Set<string>()
  return rawErrors.flatMap<AnyCircuitElement>((error) => {
    const key = keyByError.get(error)
    const summary = key === undefined ? undefined : summaries.get(key)
    if (!summary || key === undefined) return [error]
    if (emitted.has(key)) return []
    emitted.add(key)
    return [summary]
  })
}
