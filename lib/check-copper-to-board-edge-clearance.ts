import * as Flatten from "@flatten-js/core"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbComponent,
  PcbPlacementError,
  PcbPlatedHole,
  PcbSmtPad,
  PcbVia,
} from "circuit-json"
import { getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import { getRotatedRectPoints } from "lib/check-each-pcb-trace-non-overlapping/segment-to-polygon-clearance"

type CopperElement = PcbVia | PcbSmtPad | PcbPlatedHole

type CopperGeometry =
  | { kind: "shape"; shape: Flatten.Circle | Flatten.Polygon }
  | { kind: "pill"; centerLine: Flatten.Segment; radius: number }

const GEOMETRY_EPSILON = 1e-9

const pointsToPolygon = (
  points: Array<{ x: number; y: number }>,
): Flatten.Polygon | null => {
  if (points.length < 3) return null
  return new Flatten.Polygon(points.map(({ x, y }) => new Flatten.Point(x, y)))
}

const boardToPolygon = (board: PcbBoard): Flatten.Polygon | null => {
  if (board.outline && board.outline.length >= 3) {
    return pointsToPolygon(board.outline)
  }

  if (
    !board.center ||
    typeof board.width !== "number" ||
    typeof board.height !== "number"
  ) {
    return null
  }

  const halfWidth = board.width / 2
  const halfHeight = board.height / 2
  return pointsToPolygon([
    { x: board.center.x - halfWidth, y: board.center.y - halfHeight },
    { x: board.center.x + halfWidth, y: board.center.y - halfHeight },
    { x: board.center.x + halfWidth, y: board.center.y + halfHeight },
    { x: board.center.x - halfWidth, y: board.center.y + halfHeight },
  ])
}

const rotatedRect = ({
  x,
  y,
  width,
  height,
  rotation = 0,
}: {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}): CopperGeometry | null => {
  const polygon = pointsToPolygon(
    getRotatedRectPoints({
      x,
      y,
      width,
      height,
      ccwRotation: rotation,
    }),
  )
  return polygon ? { kind: "shape", shape: polygon } : null
}

const pill = ({
  x,
  y,
  width,
  height,
  radius,
  rotation = 0,
}: {
  x: number
  y: number
  width: number
  height: number
  radius: number
  rotation?: number
}): CopperGeometry => {
  const halfLineLength = Math.max(Math.max(width, height) / 2 - radius, 0)
  const localAxis =
    width >= height ? { x: halfLineLength, y: 0 } : { x: 0, y: halfLineLength }
  const angle = (rotation * Math.PI) / 180
  const axis = {
    x: localAxis.x * Math.cos(angle) - localAxis.y * Math.sin(angle),
    y: localAxis.x * Math.sin(angle) + localAxis.y * Math.cos(angle),
  }

  if (halfLineLength <= GEOMETRY_EPSILON) {
    return {
      kind: "shape",
      shape: new Flatten.Circle(new Flatten.Point(x, y), radius),
    }
  }

  return {
    kind: "pill",
    centerLine: new Flatten.Segment(
      new Flatten.Point(x - axis.x, y - axis.y),
      new Flatten.Point(x + axis.x, y + axis.y),
    ),
    radius,
  }
}

const getSmtPadGeometry = (pad: PcbSmtPad): CopperGeometry | null => {
  switch (pad.shape) {
    case "circle":
      return {
        kind: "shape",
        shape: new Flatten.Circle(new Flatten.Point(pad.x, pad.y), pad.radius),
      }
    case "rect":
      return rotatedRect({
        x: pad.x,
        y: pad.y,
        width: pad.width,
        height: pad.height,
      })
    case "rotated_rect":
      return rotatedRect({
        x: pad.x,
        y: pad.y,
        width: pad.width,
        height: pad.height,
        rotation: pad.ccw_rotation,
      })
    case "pill":
      return pill({
        x: pad.x,
        y: pad.y,
        width: pad.width,
        height: pad.height,
        radius: pad.radius,
      })
    case "rotated_pill":
      return pill({
        x: pad.x,
        y: pad.y,
        width: pad.width,
        height: pad.height,
        radius: pad.radius,
        rotation: pad.ccw_rotation,
      })
    case "polygon": {
      const polygon = pointsToPolygon(pad.points)
      return polygon ? { kind: "shape", shape: polygon } : null
    }
  }
}

const getPlatedHoleGeometry = (
  platedHole: PcbPlatedHole,
  componentRotation: number,
): CopperGeometry | null => {
  switch (platedHole.shape) {
    case "circle":
      return {
        kind: "shape",
        shape: new Flatten.Circle(
          new Flatten.Point(platedHole.x, platedHole.y),
          platedHole.outer_diameter / 2,
        ),
      }
    case "oval":
    case "pill":
      return pill({
        x: platedHole.x,
        y: platedHole.y,
        width: platedHole.outer_width,
        height: platedHole.outer_height,
        radius: Math.min(
          platedHole.outer_width / 2,
          platedHole.outer_height / 2,
        ),
        rotation: platedHole.ccw_rotation,
      })
    case "circular_hole_with_rect_pad":
    case "pill_hole_with_rect_pad":
    case "rotated_pill_hole_with_rect_pad":
      return rotatedRect({
        x: platedHole.x,
        y: platedHole.y,
        width: platedHole.rect_pad_width,
        height: platedHole.rect_pad_height,
        rotation:
          "rect_ccw_rotation" in platedHole
            ? (platedHole.rect_ccw_rotation ?? 0)
            : 0,
      })
    case "hole_with_polygon_pad": {
      const angle =
        ((platedHole.ccw_rotation ?? componentRotation) * Math.PI) / 180
      const polygon = pointsToPolygon(
        platedHole.pad_outline.map((point) => ({
          x:
            platedHole.x +
            point.x * Math.cos(angle) -
            point.y * Math.sin(angle),
          y:
            platedHole.y +
            point.x * Math.sin(angle) +
            point.y * Math.cos(angle),
        })),
      )
      return polygon ? { kind: "shape", shape: polygon } : null
    }
  }
}

const getCopperGeometry = (
  element: CopperElement,
  componentRotations: Map<string, number>,
): CopperGeometry | null => {
  if (element.type === "pcb_via") {
    return {
      kind: "shape",
      shape: new Flatten.Circle(
        new Flatten.Point(element.x, element.y),
        element.outer_diameter / 2,
      ),
    }
  }
  if (element.type === "pcb_smtpad") return getSmtPadGeometry(element)
  return getPlatedHoleGeometry(
    element,
    element.pcb_component_id
      ? (componentRotations.get(element.pcb_component_id) ?? 0)
      : 0,
  )
}

const getCopperElementId = (element: CopperElement): string => {
  if (element.type === "pcb_via") return element.pcb_via_id
  if (element.type === "pcb_smtpad") return element.pcb_smtpad_id
  return element.pcb_plated_hole_id
}

const getCopperElementLabel = (element: CopperElement): string => {
  if (element.type === "pcb_via") return "Via"
  if (element.type === "pcb_smtpad") return "SMT pad"
  return "Plated hole"
}

const measureClearance = (
  board: Flatten.Polygon,
  geometry: CopperGeometry,
): { isInside: boolean; clearance: number } => {
  if (geometry.kind === "shape") {
    const isInside = board.contains(geometry.shape)
    return {
      isInside,
      clearance: isInside ? board.distanceTo(geometry.shape)[0] : 0,
    }
  }

  const centerLineClearance = board.distanceTo(geometry.centerLine)[0]
  const clearance = centerLineClearance - geometry.radius
  const isInside =
    board.contains(geometry.centerLine) && clearance >= -GEOMETRY_EPSILON
  return {
    isInside,
    clearance: isInside ? Math.max(0, clearance) : 0,
  }
}

/**
 * Checks the finished copper geometry of every via, SMT pad, and plated hole
 * against the real board outline and its configured edge-clearance rule.
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

  const boardPolygon = boardToPolygon(board)
  if (!boardPolygon) return []

  const requiredClearance =
    getBoardDrcValue(board, "min_board_edge_clearance") ??
    jlcMinTolerances.min_board_edge_clearance
  if (requiredClearance === undefined) return []

  const copperElements = circuitJson.filter(
    (element): element is CopperElement =>
      element.type === "pcb_via" ||
      element.type === "pcb_smtpad" ||
      element.type === "pcb_plated_hole",
  )
  const componentRotations = new Map(
    circuitJson
      .filter(
        (element): element is PcbComponent => element.type === "pcb_component",
      )
      .map((component) => [component.pcb_component_id, component.rotation]),
  )

  const errors: PcbPlacementError[] = []
  for (const element of copperElements) {
    const geometry = getCopperGeometry(element, componentRotations)
    if (!geometry) continue

    const { isInside, clearance } = measureClearance(boardPolygon, geometry)
    if (isInside && clearance + GEOMETRY_EPSILON >= requiredClearance) {
      continue
    }

    const id = getCopperElementId(element)
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
