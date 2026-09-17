import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  PcbComponent,
  PcbPlacementError,
} from "circuit-json"
import { getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import { convertCircuitJsonToFlattenJs } from "@tscircuit/circuit-json-to-flattenjs"
type CopperElement = Extract<
  AnyCircuitElement,
  { type: "pcb_via" | "pcb_smtpad" | "pcb_plated_hole" | "pcb_copper_pour" }
>

const GEOMETRY_EPSILON = 1e-9

const getCopperElementLabel = (element: CopperElement): string => {
  if (element.type === "pcb_via") return "Via"
  if (element.type === "pcb_smtpad") return "SMT pad"
  if (element.type === "pcb_plated_hole") return "Plated hole"
  return "Copper pour"
}

/**
 * Checks the finished copper geometry of every via, SMT pad, plated hole, and
 * copper pour against the real board outline and its configured edge-clearance
 * rule.
 *
 * Component and footprint rotations are normally composed into Circuit JSON's
 * absolute coordinates and `ccw_rotation` fields. Polygon-pad plated holes are
 * the exception: their outline stays local, so it is translated and rotated by
 * the owning component here.
 */
export function checkCopperToBoardEdgeClearance(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  const board = getPcbBoard(circuitJson)
  if (!board) return []

  const boardPolygon = convertCircuitJsonToFlattenJs([board], { strict: true })
    .elements[0]?.shapes[0]
  if (!boardPolygon) return []

  const requiredClearance =
    getBoardDrcValue(board, "min_board_edge_clearance") ??
    jlcMinTolerances.min_board_edge_clearance
  if (requiredClearance === undefined) return []

  const allowedOffBoardComponentIds = new Set<string>(
    circuitJson
      .filter(
        (element): element is PcbComponent => element.type === "pcb_component",
      )
      .filter((component) => component.is_allowed_to_be_off_board)
      .map((component) => component.pcb_component_id),
  )

  const { elements: copperElements } = convertCircuitJsonToFlattenJs(
    circuitJson,
    {
      elementTypes: [
        "pcb_via",
        "pcb_smtpad",
        "pcb_plated_hole",
        "pcb_copper_pour",
      ],
      includeDrillHoles: false,
      strict: true,
    },
  )
  const errors: PcbPlacementError[] = []
  const seen = new Set<string>()
  for (const geometry of copperElements) {
    if (seen.has(geometry.elementId)) continue
    seen.add(geometry.elementId)
    const element = geometry.sourceElement as CopperElement
    if (
      (element.type === "pcb_smtpad" || element.type === "pcb_plated_hole") &&
      element.pcb_component_id &&
      allowedOffBoardComponentIds.has(element.pcb_component_id)
    ) {
      continue
    }

    const isInside = geometry.shapes.every((shape) =>
      boardPolygon.contains(shape),
    )
    const clearance = isInside
      ? Math.min(
          ...geometry.shapes.map((shape) => boardPolygon.distanceTo(shape)[0]),
        )
      : 0
    if (isInside && clearance + GEOMETRY_EPSILON >= requiredClearance) {
      continue
    }

    const id = geometry.elementId
    const label = getCopperElementLabel(element)
    errors.push({
      type: "pcb_placement_error",
      pcb_placement_error_id: `copper_too_close_to_board_edge_${id}`,
      error_type: "pcb_placement_error",
      message: `${label} ${id} violates copper-to-board-edge clearance (measured ${clearance.toFixed(3)}mm, required ${requiredClearance.toFixed(3)}mm)`,
    })
  }

  return errors
}
