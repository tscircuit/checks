import { cju } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement } from "circuit-json"

/** Resolve rendered components through explicit ownership or trace connections. */
export function getSchematicAnnotationComponentIds(
  circuitJson: AnyCircuitElement[],
  elementId: string,
): string[] {
  const db = cju(circuitJson)
  const component = db.schematic_component.get(elementId)
  if (component) return [component.schematic_component_id]
  const element =
    db.schematic_text.get(elementId) ?? db.schematic_trace.get(elementId)
  if (!element) return []
  if (element.type === "schematic_text" && element.schematic_component_id) {
    return db.schematic_component.get(element.schematic_component_id)
      ? [element.schematic_component_id]
      : []
  }
  if (!element.source_trace_id) return []
  const trace = db.source_trace.get(element.source_trace_id)
  if (!trace) return []
  const sourceComponentIds = new Set(
    trace.connected_source_port_ids.map(
      (id) => db.source_port.get(id)?.source_component_id,
    ),
  )
  return db.schematic_component
    .list()
    .filter(
      (c) =>
        c.schematic_sheet_id === element.schematic_sheet_id &&
        c.source_component_id &&
        sourceComponentIds.has(c.source_component_id),
    )
    .map((c) => c.schematic_component_id)
}
