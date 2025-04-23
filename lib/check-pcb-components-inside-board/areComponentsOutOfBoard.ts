import type {
  AnyCircuitElement,
  PcbBoard,
  PcbPlacementError,
} from "circuit-json"

export function checkPcbComponentsOutOfBoard(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  const board = circuitJson.find(
    (el): el is PcbBoard => "width" in el && "height" in el,
  ) as PcbBoard
  if (!board) return []

  const components = circuitJson.filter((el) => el.type === "pcb_component")

  const boardMinX = board.center.x - board.width / 2
  const boardMaxX = board.center.x + board.width / 2
  const boardMinY = board.center.y - board.height / 2
  const boardMaxY = board.center.y + board.height / 2

  const errors: PcbPlacementError[] = []

  for (const comp of components) {
    console.log("comp", comp)
    const minX = comp.center.x - comp.width / 2
    const maxX = comp.center.x + comp.width / 2
    const minY = comp.center.y - comp.height / 2
    const maxY = comp.center.y + comp.height / 2
    const sourceComponent = comp.source_component_id

    if (
      minX < boardMinX ||
      maxX > boardMaxX ||
      minY < boardMinY ||
      maxY > boardMaxY
    ) {
      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `out_of_board_${comp.pcb_component_id}`,
        message: `Component ${sourceComponent ?? "unknown"} out of board`,
      })
    }
  }

  return errors
}
