import { Relations } from "@flatten-js/core"
import { getPrimaryId } from "@tscircuit/circuit-json-util"
import {
  convertCircuitJsonToFlattenJs,
  type FlattenElement,
} from "@tscircuit/circuit-json-to-flattenjs"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbCutout,
  PcbPlacementError,
  PcbTrace,
} from "circuit-json"
import { getBoardDrcValue, getPcbBoard } from "./drc-defaults"
import { getBoardOwnerResolver } from "./util/get-board-owner-resolver"
import { getReadableNameForElementId } from "./util/get-readable-names"
import { getConservativeCutoutClearanceBounds } from "./util/get-conservative-cutout-clearance-bounds"

type CopperElementType =
  | "pcb_trace"
  | "pcb_via"
  | "pcb_smtpad"
  | "pcb_plated_hole"
  | "pcb_copper_pour"

export interface PcbCopperCutoutClearanceError extends PcbPlacementError {
  pcb_cutout_id: PcbCutout["pcb_cutout_id"]
  pcb_element_id: FlattenElement["elementId"]
  minimum_clearance: number
  actual_clearance: number
  center: { x: number; y: number }
}

/**
 * Cutouts are internal board edges on every copper layer, including cutouts
 * owned by the copper's own footprint. The shared converter provides finished
 * copper and cutout polygons in absolute board coordinates: mm, +X right,
 * +Y up, without mirroring bottom layers. Preserve drill and pour holes.
 */
export function checkCopperToCutoutClearance(
  circuitJson: AnyCircuitElement[],
  {
    elementTypes = [
      "pcb_trace",
      "pcb_via",
      "pcb_smtpad",
      "pcb_plated_hole",
      "pcb_copper_pour",
    ],
  }: { elementTypes?: CopperElementType[] } = {},
): PcbPlacementError[] {
  if (!circuitJson.some((element) => element.type === "pcb_cutout")) return []
  if (
    !circuitJson.some((element) =>
      elementTypes.some((type) => type === element.type),
    )
  )
    return []

  const defaultBoard = getPcbBoard(circuitJson)
  const boardsById = new Map<string, PcbBoard>(
    circuitJson.flatMap((el) =>
      el.type === "pcb_board" ? [[el.pcb_board_id, el] as const] : [],
    ),
  )
  const tracesById = new Map<string, PcbTrace>(
    circuitJson.flatMap((el) =>
      el.type === "pcb_trace" ? [[el.pcb_trace_id, el] as const] : [],
    ),
  )
  const getBoardOwner = getBoardOwnerResolver(circuitJson)
  const resolveBoardId = (
    element: AnyCircuitElement | undefined,
  ): string | undefined => {
    if (!element) return undefined
    const directBoardId = getBoardOwner(element)
    if (directBoardId) return directBoardId
    if ("pcb_trace_id" in element && element.pcb_trace_id) {
      const trace = tracesById.get(element.pcb_trace_id)
      if (trace) return getBoardOwner(trace)
    }
    return undefined
  }
  const getRequiredClearance = (board: PcbBoard | undefined): number =>
    getBoardDrcValue(board, "min_board_edge_clearance") ??
    jlcMinTolerances.min_board_edge_clearance ??
    0

  const { elements, warnings } = convertCircuitJsonToFlattenJs(circuitJson, {
    elementTypes: [...elementTypes, "pcb_cutout"],
  })
  const cutouts = elements.filter((element) => element.role === "cutout")
  const copper = elements.filter((element) => element.role === "copper")
  const unconverted = warnings.map((warning) => {
    const element = circuitJson.find(
      (candidate) => getPrimaryId(candidate) === warning.elementId,
    )
    return {
      warning,
      element,
      boardId: resolveBoardId(element),
      bounds: element
        ? getConservativeCutoutClearanceBounds(element, circuitJson)
        : undefined,
    }
  })
  const cutoutBounds = [
    ...cutouts.map((cutout) => ({
      bounds: cutout.bounds,
      boardId: resolveBoardId(cutout.sourceElement),
    })),
    ...unconverted
      .filter(({ warning }) => warning.elementType === "pcb_cutout")
      .map(({ bounds, boardId }) => ({ bounds, boardId })),
  ]
  const copperBounds = [
    ...copper.map((geometry) => ({
      bounds: geometry.bounds,
      boardId: resolveBoardId(geometry.sourceElement),
    })),
    ...unconverted
      .filter(({ warning }) => warning.elementType !== "pcb_cutout")
      .map(({ bounds, boardId }) => ({ bounds, boardId })),
  ]
  const relevantWarnings = unconverted.filter(
    ({ warning, bounds, boardId }) => {
      const counterparts =
        warning.elementType === "pcb_cutout" ? copperBounds : cutoutBounds
      return counterparts.some((counterpart) => {
        if (boardId && counterpart.boardId && boardId !== counterpart.boardId) {
          return false
        }
        const ownerBoardId = boardId ?? counterpart.boardId
        const owningBoard =
          (ownerBoardId ? boardsById.get(ownerBoardId) : undefined) ??
          defaultBoard
        const requiredClearance = getRequiredClearance(owningBoard)
        return (
          !bounds ||
          !counterpart.bounds ||
          bounds.clone().extend(requiredClearance).intersect(counterpart.bounds)
        )
      })
    },
  )
  const errors: PcbPlacementError[] = relevantWarnings.map(({ warning }) => ({
    type: "pcb_placement_error",
    error_type: "pcb_placement_error",
    pcb_placement_error_id: `unverified_cutout_clearance_${warning.elementId}`,
    message: `Cannot verify copper-to-cutout clearance for ${getReadableNameForElementId(circuitJson, warning.elementId)} because its PCB geometry is unsupported or invalid`,
  }))

  for (const cutout of cutouts) {
    const cutoutBoardId = resolveBoardId(cutout.sourceElement)
    const reportedCopperIds = new Set<FlattenElement["elementId"]>()
    for (const copperGeometry of copper) {
      if (reportedCopperIds.has(copperGeometry.elementId)) continue
      const copperBoardId = resolveBoardId(copperGeometry.sourceElement)
      if (cutoutBoardId && copperBoardId && cutoutBoardId !== copperBoardId) {
        continue
      }
      const ownerBoardId = cutoutBoardId ?? copperBoardId
      const owningBoard =
        (ownerBoardId ? boardsById.get(ownerBoardId) : undefined) ??
        defaultBoard
      const requiredClearance = getRequiredClearance(owningBoard)
      const clearanceBounds = cutout.bounds.clone().extend(requiredClearance)
      if (!copperGeometry.bounds.intersect(clearanceBounds)) continue
      let clearance = Infinity
      let intersects = false
      let center = copperGeometry.bounds.center
      for (const copperPolygon of copperGeometry.shapes) {
        for (const cutoutPolygon of cutout.shapes) {
          const overlaps = Relations.intersect(copperPolygon, cutoutPolygon)
          const [distance, shortestSegment] =
            copperPolygon.distanceTo(cutoutPolygon)
          const measuredClearance = overlaps ? 0 : distance
          intersects ||= overlaps
          if (measuredClearance < clearance) {
            clearance = measuredClearance
            center = overlaps
              ? (copperPolygon.intersect(cutoutPolygon)[0] ??
                copperPolygon.box.center)
              : shortestSegment.middle()
          }
        }
      }
      if (!intersects && clearance + 1e-9 >= requiredClearance) continue

      reportedCopperIds.add(copperGeometry.elementId)
      const error: PcbCopperCutoutClearanceError = {
        type: "pcb_placement_error",
        error_type: "pcb_placement_error",
        pcb_placement_error_id: `copper_to_cutout_${copperGeometry.elementId}_${cutout.elementId}`,
        pcb_cutout_id: cutout.elementId,
        pcb_element_id: copperGeometry.elementId,
        actual_clearance: clearance,
        minimum_clearance: requiredClearance,
        center: { x: center.x, y: center.y },
        message: `Copper for ${getReadableNameForElementId(circuitJson, copperGeometry.elementId)} violates clearance to cutout ${getReadableNameForElementId(circuitJson, cutout.elementId)} (measured ${clearance.toFixed(3)}mm, required ${requiredClearance.toFixed(3)}mm)`,
        ...("subcircuit_id" in copperGeometry.sourceElement
          ? { subcircuit_id: copperGeometry.sourceElement.subcircuit_id }
          : {}),
      }
      errors.push(error)
    }
  }

  return errors
}
