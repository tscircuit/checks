import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, PcbPlacementError } from "circuit-json"
import { checkCopperToBoardEdgeClearance } from "lib/check-copper-to-board-edge-clearance"

export function checkViasOffBoard(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  const vias = circuitJson.filter((element) => element.type === "pcb_via")
  const violationsById = new Map(
    checkCopperToBoardEdgeClearance(
      circuitJson.filter(
        (element) => element.type === "pcb_board" || element.type === "pcb_via",
      ),
    ).map((error) => [
      error.pcb_placement_error_id.replace(
        "copper_too_close_to_board_edge_",
        "",
      ),
      error,
    ]),
  )

  return vias.flatMap((via) => {
    const violation = violationsById.get(via.pcb_via_id)
    if (!violation) return []

    const viaName = getReadableNameForElement(circuitJson, via.pcb_via_id)
    return [
      {
        ...violation,
        pcb_placement_error_id: `out_of_board_${via.pcb_via_id}`,
        message: `Via ${viaName} is outside or crossing the board boundary`,
      },
    ]
  })
}
