import * as Flatten from "@flatten-js/core"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbComponent,
  PcbCopperPour,
  PcbPlacementError,
  PcbPlatedHole,
  PcbSmtPad,
  PcbVia,
} from "circuit-json"
import { getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import { applyToPoint, rotateDEG } from "transformation-matrix"

type CopperElement = PcbVia | PcbSmtPad | PcbPlatedHole | PcbCopperPour
declare const pcbComponentIdBrand: unique symbol
type PcbComponentId = string & {
  readonly [pcbComponentIdBrand]: "PcbComponentId"
}
const toPcbComponentId = (id: string): PcbComponentId => id as PcbComponentId
type CopperShape = Flatten.Circle | Flatten.Polygon

type CopperGeometry =
  | { kind: "shapes"; shapes: CopperShape[] }
  | { kind: "pill"; centerLine: Flatten.Segment; radius: number }

const GEOMETRY_EPSILON = 1e-9

export const pointsToPolygon = (
  points: Array<{ x: number; y: number }>,
): Flatten.Polygon | null => {
  if (points.length < 3) return null
  return new Flatten.Polygon(points.map(({ x, y }) => new Flatten.Point(x, y)))
}

export const brepRingToPolygon = (
  vertices: Array<{ x: number; y: number; bulge?: number }>,
): Flatten.Polygon | null => {
  const ring = vertices.filter((vertex, index) => {
    const previous = vertices[index - 1]
    return (
      !previous ||
      Math.abs(previous.x - vertex.x) > GEOMETRY_EPSILON ||
      Math.abs(previous.y - vertex.y) > GEOMETRY_EPSILON
    )
  })
  if (
    ring.length > 1 &&
    Math.abs(ring[0].x - ring.at(-1)!.x) <= GEOMETRY_EPSILON &&
    Math.abs(ring[0].y - ring.at(-1)!.y) <= GEOMETRY_EPSILON
  ) {
    ring.pop()
  }
  if (ring.length < 3) return null

  const edges: Array<Flatten.Segment | Flatten.Arc> = []
  for (let index = 0; index < ring.length; index++) {
    const start = ring[index]
    const end = ring[(index + 1) % ring.length]
    const startPoint = new Flatten.Point(start.x, start.y)
    const endPoint = new Flatten.Point(end.x, end.y)
    const bulge = start.bulge ?? 0
    if (Math.abs(bulge) <= GEOMETRY_EPSILON) {
      edges.push(new Flatten.Segment(startPoint, endPoint))
      continue
    }

    const chordLength = startPoint.distanceTo(endPoint)[0]
    if (chordLength <= GEOMETRY_EPSILON) continue
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    }
    const leftNormal = {
      x: -(end.y - start.y) / chordLength,
      y: (end.x - start.x) / chordLength,
    }
    const centerOffset = (chordLength * (1 - bulge * bulge)) / (4 * bulge)
    const center = new Flatten.Point(
      midpoint.x + leftNormal.x * centerOffset,
      midpoint.y + leftNormal.y * centerOffset,
    )
    const radius = (chordLength * (1 + bulge * bulge)) / (4 * Math.abs(bulge))
    edges.push(
      new Flatten.Arc(
        center,
        radius,
        Math.atan2(start.y - center.y, start.x - center.x),
        Math.atan2(end.y - center.y, end.x - center.x),
        bulge > 0,
      ),
    )
  }

  if (edges.length < 3) return null
  const polygon = new Flatten.Polygon()
  polygon.addFace(edges)
  return polygon
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

export const getRectanglePolygon = ({
  x,
  y,
  width,
  height,
  ccwRotationDegrees = 0,
}: {
  x: number
  y: number
  width: number
  height: number
  ccwRotationDegrees?: number
}): Flatten.Polygon | null => {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const rotationMatrix = rotateDEG(ccwRotationDegrees, x, y)
  return pointsToPolygon(
    [
      { x: x - halfWidth, y: y - halfHeight },
      { x: x + halfWidth, y: y - halfHeight },
      { x: x + halfWidth, y: y + halfHeight },
      { x: x - halfWidth, y: y + halfHeight },
    ].map((point) => applyToPoint(rotationMatrix, point)),
  )
}

/** Model a rounded rectangle exactly as the union of two bands and its corners. */
const roundedRect = ({
  x,
  y,
  width,
  height,
  cornerRadius,
  ccwRotationDegrees = 0,
}: {
  x: number
  y: number
  width: number
  height: number
  cornerRadius: number
  ccwRotationDegrees?: number
}): CopperGeometry | null => {
  const radius = Math.max(0, Math.min(cornerRadius, width / 2, height / 2))
  if (radius <= GEOMETRY_EPSILON) {
    const polygon = getRectanglePolygon({
      x,
      y,
      width,
      height,
      ccwRotationDegrees,
    })
    return polygon ? { kind: "shapes", shapes: [polygon] } : null
  }

  const shapes: CopperShape[] = []
  const innerWidth = width - 2 * radius
  const innerHeight = height - 2 * radius
  if (innerWidth > GEOMETRY_EPSILON) {
    const verticalBand = getRectanglePolygon({
      x,
      y,
      width: innerWidth,
      height,
      ccwRotationDegrees,
    })
    if (verticalBand) shapes.push(verticalBand)
  }
  if (innerHeight > GEOMETRY_EPSILON) {
    const horizontalBand = getRectanglePolygon({
      x,
      y,
      width,
      height: innerHeight,
      ccwRotationDegrees,
    })
    if (horizontalBand) shapes.push(horizontalBand)
  }

  const halfInnerWidth = innerWidth / 2
  const halfInnerHeight = innerHeight / 2
  const rotationMatrix = rotateDEG(ccwRotationDegrees, x, y)
  const cornerCenters = [
    { x: x - halfInnerWidth, y: y - halfInnerHeight },
    { x: x + halfInnerWidth, y: y - halfInnerHeight },
    { x: x + halfInnerWidth, y: y + halfInnerHeight },
    { x: x - halfInnerWidth, y: y + halfInnerHeight },
  ]
    .map((point) => applyToPoint(rotationMatrix, point))
    .filter(
      (point, index, points) =>
        points.findIndex(
          (candidate) =>
            Math.abs(candidate.x - point.x) <= GEOMETRY_EPSILON &&
            Math.abs(candidate.y - point.y) <= GEOMETRY_EPSILON,
        ) === index,
    )
  shapes.push(
    ...cornerCenters.map(
      (center) =>
        new Flatten.Circle(new Flatten.Point(center.x, center.y), radius),
    ),
  )

  return shapes.length > 0 ? { kind: "shapes", shapes } : null
}

const pill = ({
  x,
  y,
  width,
  height,
  radius,
  ccwRotationDegrees = 0,
}: {
  x: number
  y: number
  width: number
  height: number
  radius: number
  ccwRotationDegrees?: number
}): CopperGeometry => {
  const halfLineLength = Math.max(Math.max(width, height) / 2 - radius, 0)
  const localAxis =
    width >= height ? { x: halfLineLength, y: 0 } : { x: 0, y: halfLineLength }
  const axis = applyToPoint(rotateDEG(ccwRotationDegrees), localAxis)

  if (halfLineLength <= GEOMETRY_EPSILON) {
    return {
      kind: "shapes",
      shapes: [new Flatten.Circle(new Flatten.Point(x, y), radius)],
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
        kind: "shapes",
        shapes: [
          new Flatten.Circle(new Flatten.Point(pad.x, pad.y), pad.radius),
        ],
      }
    case "rect":
      return roundedRect({
        x: pad.x,
        y: pad.y,
        width: pad.width,
        height: pad.height,
        cornerRadius: pad.rect_border_radius ?? pad.corner_radius ?? 0,
      })
    case "rotated_rect":
      return roundedRect({
        x: pad.x,
        y: pad.y,
        width: pad.width,
        height: pad.height,
        cornerRadius: pad.rect_border_radius ?? pad.corner_radius ?? 0,
        ccwRotationDegrees: pad.ccw_rotation,
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
        ccwRotationDegrees: pad.ccw_rotation,
      })
    case "polygon": {
      const polygon = pointsToPolygon(pad.points)
      return polygon ? { kind: "shapes", shapes: [polygon] } : null
    }
  }
}

const getPlatedHoleGeometry = (
  platedHole: PcbPlatedHole,
  componentCcwRotationDegrees: number,
): CopperGeometry | null => {
  switch (platedHole.shape) {
    case "circle":
      return {
        kind: "shapes",
        shapes: [
          new Flatten.Circle(
            new Flatten.Point(platedHole.x, platedHole.y),
            platedHole.outer_diameter / 2,
          ),
        ],
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
        ccwRotationDegrees: platedHole.ccw_rotation,
      })
    case "circular_hole_with_rect_pad":
    case "pill_hole_with_rect_pad":
    case "rotated_pill_hole_with_rect_pad":
      return roundedRect({
        x: platedHole.x,
        y: platedHole.y,
        width: platedHole.rect_pad_width,
        height: platedHole.rect_pad_height,
        cornerRadius: platedHole.rect_border_radius ?? 0,
        ccwRotationDegrees:
          "rect_ccw_rotation" in platedHole
            ? (platedHole.rect_ccw_rotation ?? 0)
            : 0,
      })
    case "hole_with_polygon_pad": {
      const ccwRotationDegrees =
        platedHole.ccw_rotation ?? componentCcwRotationDegrees
      const rotationMatrix = rotateDEG(ccwRotationDegrees)
      const polygon = pointsToPolygon(
        platedHole.pad_outline.map((point) => {
          const rotatedPoint = applyToPoint(rotationMatrix, point)
          return {
            x: platedHole.x + rotatedPoint.x,
            y: platedHole.y + rotatedPoint.y,
          }
        }),
      )
      return polygon ? { kind: "shapes", shapes: [polygon] } : null
    }
  }
}

export const getCopperPourPolygon = (
  copperPour: PcbCopperPour,
): Flatten.Polygon | null => {
  if (copperPour.shape === "rect") {
    return getRectanglePolygon({
      x: copperPour.center.x,
      y: copperPour.center.y,
      width: copperPour.width,
      height: copperPour.height,
      ccwRotationDegrees: copperPour.rotation ?? 0,
    })
  }

  if (copperPour.shape === "polygon") {
    return pointsToPolygon(copperPour.points)
  }

  const polygon = brepRingToPolygon(copperPour.brep_shape.outer_ring.vertices)
  if (!polygon) return null

  const outerFace = [...polygon.faces][0]
  if (!outerFace) return null

  for (const innerRing of copperPour.brep_shape.inner_rings) {
    const innerPolygon = brepRingToPolygon(innerRing.vertices)
    const innerFace = innerPolygon ? [...innerPolygon.faces][0] : undefined
    if (!innerFace) continue

    if (innerFace.orientation() === outerFace.orientation()) {
      innerFace.reverse()
    }
    polygon.addFace(innerFace.shapes)
  }

  return polygon.rearrange()
}

const getCopperGeometry = (
  element: CopperElement,
  componentCcwRotationsById: Map<PcbComponentId, number>,
): CopperGeometry | null => {
  if (element.type === "pcb_via") {
    return {
      kind: "shapes",
      shapes: [
        new Flatten.Circle(
          new Flatten.Point(element.x, element.y),
          element.outer_diameter / 2,
        ),
      ],
    }
  }
  if (element.type === "pcb_smtpad") return getSmtPadGeometry(element)
  if (element.type === "pcb_plated_hole") {
    return getPlatedHoleGeometry(
      element,
      element.pcb_component_id
        ? (componentCcwRotationsById.get(
            toPcbComponentId(element.pcb_component_id),
          ) ?? 0)
        : 0,
    )
  }

  const polygon = getCopperPourPolygon(element)
  return polygon ? { kind: "shapes", shapes: [polygon] } : null
}

const getCopperElementId = (element: CopperElement): string => {
  if (element.type === "pcb_via") return element.pcb_via_id
  if (element.type === "pcb_smtpad") return element.pcb_smtpad_id
  if (element.type === "pcb_plated_hole") return element.pcb_plated_hole_id
  return element.pcb_copper_pour_id
}

const getCopperElementLabel = (element: CopperElement): string => {
  if (element.type === "pcb_via") return "Via"
  if (element.type === "pcb_smtpad") return "SMT pad"
  if (element.type === "pcb_plated_hole") return "Plated hole"
  return "Copper pour"
}

const measureClearance = (
  board: Flatten.Polygon,
  geometry: CopperGeometry,
): { isInside: boolean; clearance: number } => {
  if (geometry.kind === "shapes") {
    const isInside = geometry.shapes.every((shape) => board.contains(shape))
    return {
      isInside,
      clearance: isInside
        ? Math.min(
            ...geometry.shapes.map((shape) => board.distanceTo(shape)[0]),
          )
        : 0,
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
      element.type === "pcb_plated_hole" ||
      element.type === "pcb_copper_pour",
  )
  const componentCcwRotationsById = new Map<PcbComponentId, number>(
    circuitJson
      .filter(
        (element): element is PcbComponent => element.type === "pcb_component",
      )
      .map((component) => [
        toPcbComponentId(component.pcb_component_id),
        component.rotation,
      ]),
  )

  const errors: PcbPlacementError[] = []
  for (const element of copperElements) {
    const geometry = getCopperGeometry(element, componentCcwRotationsById)
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
