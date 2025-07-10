import type {
  AnyCircuitElement,
  PcbBoard,
  PcbPlacementError,
} from "circuit-json"

export function checkPcbComponentsOutOfBoard(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  const board = circuitJson.find((el) => el.type === "pcb_board") as PcbBoard

  if (!board) return []

  const components = circuitJson.filter((el) => el.type === "pcb_component")

  const boardMinX = board.center.x - board.width / 2
  const boardMaxX = board.center.x + board.width / 2
  const boardMinY = board.center.y - board.height / 2
  const boardMaxY = board.center.y + board.height / 2

  const errors: PcbPlacementError[] = []

  for (const comp of components) {
    const minX = comp.center.x - comp.width / 2
    const maxX = comp.center.x + comp.width / 2
    const minY = comp.center.y - comp.height / 2
    const maxY = comp.center.y + comp.height / 2

    if (
      minX < boardMinX ||
      maxX > boardMaxX ||
      minY < boardMinY ||
      maxY > boardMaxY
    ) {
      const sourceComponent = circuitJson.find(
        (el) =>
          el.type === "source_component" &&
          el.source_component_id === comp.source_component_id,
      ) as any
      const componentType = (sourceComponent?.ftype || "unknown").replace(
        /^simple_/,
        "",
      )
      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `out_of_board_${comp.pcb_component_id}`,
        message: `Component ${componentType}[${sourceComponent!.name}] out of board`,
      })
    }
  }

  return errors
}
