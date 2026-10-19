import type { AnyCircuitElement } from "circuit-json"

/** Resolve explicit board references and then the nearest board in subcircuit ancestry.
 * Missing or cyclic ownership remains unresolved; callers choose any legacy fallback. */
export function getBoardOwnerResolver(circuitJson: AnyCircuitElement[]) {
  const boardsBySubcircuit = new Map(
    circuitJson.flatMap((element) =>
      element.type === "pcb_board" && element.subcircuit_id
        ? [[element.subcircuit_id, element.pcb_board_id] as const]
        : [],
    ),
  )
  const parentSubcircuits = new Map(
    circuitJson.flatMap((element) =>
      element.type === "source_group" &&
      element.is_subcircuit &&
      element.subcircuit_id
        ? [[element.subcircuit_id, element.parent_subcircuit_id] as const]
        : [],
    ),
  )
  const components = new Map(
    circuitJson.flatMap((element) =>
      element.type === "pcb_component"
        ? [[element.pcb_component_id, element] as const]
        : [],
    ),
  )
  return (element: AnyCircuitElement): string | undefined => {
    if ("pcb_board_id" in element && element.pcb_board_id)
      return element.pcb_board_id
    if (
      "positioned_relative_to_pcb_board_id" in element &&
      element.positioned_relative_to_pcb_board_id
    )
      return element.positioned_relative_to_pcb_board_id
    const component =
      "pcb_component_id" in element && element.pcb_component_id
        ? components.get(element.pcb_component_id)
        : undefined
    if (component?.positioned_relative_to_pcb_board_id)
      return component.positioned_relative_to_pcb_board_id
    let subcircuitId =
      ("subcircuit_id" in element ? element.subcircuit_id : undefined) ??
      component?.subcircuit_id
    const visited = new Set<string>()
    while (subcircuitId && !visited.has(subcircuitId)) {
      const boardId = boardsBySubcircuit.get(subcircuitId)
      if (boardId) return boardId
      visited.add(subcircuitId)
      subcircuitId = parentSubcircuits.get(subcircuitId)
    }
  }
}
