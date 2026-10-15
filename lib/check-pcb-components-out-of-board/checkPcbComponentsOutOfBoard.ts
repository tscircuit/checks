import type {
  AnyCircuitElement,
  PcbBoard,
  PcbComponent,
  AnySourceComponent,
  PcbComponentOutsideBoardError,
} from "circuit-json"
import { getReadableNameForComponent } from "lib/util/get-readable-names"
import type { Point } from "@tscircuit/math-utils"
import * as Flatten from "@flatten-js/core"
import { rotateDEG, applyToPoint } from "transformation-matrix"
import { convertCircuitJsonToFlattenJs } from "@tscircuit/circuit-json-to-flattenjs"

/**
 * Create a rectangle polygon centered at (cx,cy) with given width/height and rotation (degrees).
 * Uses transformation-matrix to rotate around the center and returns a Flatten.Polygon.
 */

function isPolygonCCW(poly: Flatten.Polygon): boolean {
  // @ts-ignore
  return poly.area() >= 0
}

function rectanglePolygon({
  center,
  size,
  rotationDeg = 0,
}: {
  center: Point
  size: { width: number; height: number }
  rotationDeg?: number
}): Flatten.Polygon {
  const cx = center.x
  const cy = center.y
  const hw = size.width / 2
  const hh = size.height / 2

  const corners: Flatten.Point[] = [
    new Flatten.Point(cx - hw, cy - hh),
    new Flatten.Point(cx + hw, cy - hh),
    new Flatten.Point(cx + hw, cy + hh),
    new Flatten.Point(cx - hw, cy + hh),
  ]

  let poly = new Flatten.Polygon(corners)

  if (rotationDeg) {
    const matrix = rotateDEG(rotationDeg, cx, cy)
    const rotatedCorners = corners.map((pt) => {
      const p = applyToPoint(matrix, { x: pt.x, y: pt.y })
      return new Flatten.Point(p.x, p.y)
    })
    poly = new Flatten.Polygon(rotatedCorners)
  }

  // Ensure CCW order
  if (!isPolygonCCW(poly)) poly.reverse()

  return poly
}

function boardToPolygon({
  board,
}: {
  board: PcbBoard
}): Flatten.Polygon | null {
  if (board.outline && board.outline.length > 0) {
    const points = board.outline.map((p) => new Flatten.Point(p.x, p.y))
    const poly = new Flatten.Polygon(points)

    if (!isPolygonCCW(poly)) {
      poly.reverse()
    }

    return poly
  }

  if (
    board.center &&
    typeof board.width === "number" &&
    typeof board.height === "number"
  ) {
    return rectanglePolygon({
      center: board.center,
      size: { width: board.width, height: board.height },
      rotationDeg: 0,
    })
  }

  return null
}

/** Get human-readable component name from circuit JSON */
function getComponentName({
  circuitJson,
  component,
}: {
  circuitJson: AnyCircuitElement[]
  component: PcbComponent
}): string {
  if (component.source_component_id) {
    const sourceComponent = circuitJson.find(
      (el): el is AnySourceComponent =>
        el.type === "source_component" &&
        el.source_component_id === component.source_component_id,
    )
    if (sourceComponent && "name" in sourceComponent && sourceComponent.name) {
      return sourceComponent.name
    }
  }

  return getReadableNameForComponent(circuitJson, component.pcb_component_id)
}

/** Measures overhang from the actual boundary in board coordinates (mm, +X right, +Y up). */
function computeOverlapDistance(
  componentPoly: Flatten.Polygon,
  boardPoly: Flatten.Polygon,
): number {
  const edges = [...componentPoly.edges]
  const boundary = edges[0]?.shape
  // Preserve the analytic overhang estimate for a full circle.
  if (
    edges.length === 1 &&
    boundary instanceof Flatten.Arc &&
    Flatten.Utils.EQ(boundary.sweep, 2 * Math.PI)
  ) {
    const [distance] = boardPoly.distanceTo(boundary.pc)
    return boardPoly.contains(boundary.pc)
      ? boundary.r - distance
      : boundary.r + distance
  }

  let maxDistance = 0
  for (const edge of edges) {
    const samples =
      edge.shape instanceof Flatten.Arc
        ? Math.ceil(edge.shape.sweep / (Math.PI / 32))
        : 2
    for (let i = 0; i <= samples; i++) {
      const point = edge.pointAtLength((edge.length * i) / samples)!
      if (!boardPoly.contains(point)) {
        maxDistance = Math.max(maxDistance, boardPoly.distanceTo(point)[0])
      }
    }
  }
  // Containment is checked exactly; sampling only estimates the diagnostic distance.
  return maxDistance || 0.1
}

function getRepositionSuggestion({
  componentBox,
  boardPoly,
}: {
  componentBox: Flatten.Box
  boardPoly: Flatten.Polygon
}): string | null {
  const boardBox = boardPoly.box

  let deltaX = 0
  let deltaY = 0

  if (componentBox.xmin < boardBox.xmin) {
    deltaX = boardBox.xmin - componentBox.xmin
  } else if (componentBox.xmax > boardBox.xmax) {
    deltaX = boardBox.xmax - componentBox.xmax
  }

  if (componentBox.ymin < boardBox.ymin) {
    deltaY = boardBox.ymin - componentBox.ymin
  } else if (componentBox.ymax > boardBox.ymax) {
    deltaY = boardBox.ymax - componentBox.ymax
  }

  if (deltaX === 0 && deltaY === 0) {
    return null
  }

  const xDir = deltaX >= 0 ? "right" : "left"
  const yDir = deltaY >= 0 ? "up" : "down"
  const absDx = Math.abs(Math.round(deltaX * 100) / 100)
  const absDy = Math.abs(Math.round(deltaY * 100) / 100)

  if (absDx > 0 && absDy > 0) {
    return `Try moving it ${absDx}mm ${xDir} and ${absDy}mm ${yDir} to fit within the board edge.`
  }

  if (absDx > 0) {
    return `Try moving it ${absDx}mm ${xDir} to fit within the board edge.`
  }

  return `Try moving it ${absDy}mm ${yDir} to fit within the board edge.`
}

/**
 * Checks footprint envelopes in board coordinates (mm, +X right, +Y up).
 * Retains rectangular component bounds when the footprint does not explain them.
 */
export function checkPcbComponentsOutOfBoard(
  circuitJson: AnyCircuitElement[],
): PcbComponentOutsideBoardError[] {
  const board = circuitJson.find(
    (el): el is PcbBoard => el.type === "pcb_board",
  )
  if (!board) return []

  const boardPoly = boardToPolygon({ board })
  if (!boardPoly) return []

  const components = circuitJson.filter(
    (el): el is PcbComponent => el.type === "pcb_component",
  )
  if (components.length === 0) return []

  const footprintGeometry = convertCircuitJsonToFlattenJs(circuitJson, {
    elementTypes: [
      "pcb_smtpad",
      "pcb_plated_hole",
      "pcb_hole",
      "pcb_courtyard_circle",
      "pcb_courtyard_rect",
      "pcb_courtyard_pill",
      "pcb_courtyard_polygon",
      "pcb_courtyard_outline",
    ],
    includeDrillHoles: false,
    strict: true,
  }).elements
  const errors: PcbComponentOutsideBoardError[] = []

  for (const c of components) {
    if (c.is_allowed_to_be_off_board) continue

    // need center, width, height
    if (
      !c.center ||
      typeof c.width !== "number" ||
      typeof c.height !== "number"
    )
      continue

    if (c.width <= 0 || c.height <= 0) continue

    // c.width and c.height store the world-coordinate AABB dimensions (post-rotation),
    // so we must NOT re-apply rotation here.
    const componentRect = rectanglePolygon({
      center: c.center,
      size: { width: c.width, height: c.height },
      rotationDeg: 0,
    })

    const componentGeometry = footprintGeometry.filter(
      ({ sourceElement }) =>
        "pcb_component_id" in sourceElement &&
        sourceElement.pcb_component_id === c.pcb_component_id,
    )
    const physicalBounds = componentGeometry
      .filter(({ role }) => role !== "courtyard")
      .reduce<Flatten.Box | undefined>(
        (bounds, geometry) =>
          bounds ? bounds.merge(geometry.bounds) : geometry.bounds,
        undefined,
      )
    const componentPolygons = componentGeometry.flatMap(({ shapes }) => shapes)
    // Replace a footprint-derived AABB with its real outlines, but preserve a
    // separately sized body (or missing footprint geometry) as a rectangle.
    if (
      !physicalBounds ||
      !Flatten.Utils.EQ(physicalBounds.xmin, componentRect.box.xmin) ||
      !Flatten.Utils.EQ(physicalBounds.xmax, componentRect.box.xmax) ||
      !Flatten.Utils.EQ(physicalBounds.ymin, componentRect.box.ymin) ||
      !Flatten.Utils.EQ(physicalBounds.ymax, componentRect.box.ymax)
    ) {
      componentPolygons.push(componentRect)
    }

    const outsidePolygons = componentPolygons.filter(
      (polygon) => polygon.area() > 0 && !boardPoly.contains(polygon),
    )
    if (outsidePolygons.length === 0) continue

    const componentBox = componentPolygons.reduce(
      (bounds, polygon) => bounds.merge(polygon.box),
      componentPolygons[0].box,
    )
    const overlapDistance = Math.max(
      ...outsidePolygons.map((polygon) =>
        computeOverlapDistance(polygon, boardPoly),
      ),
    )

    const compName = getComponentName({ circuitJson, component: c })
    const overlapDistanceMm = Math.round(overlapDistance * 100) / 100
    const repositionSuggestion = getRepositionSuggestion({
      componentBox,
      boardPoly,
    })

    errors.push({
      type: "pcb_component_outside_board_error",
      error_type: "pcb_component_outside_board_error",
      pcb_component_outside_board_error_id: `pcb_component_outside_board_${c.pcb_component_id}`,
      message: `Component ${compName} extends outside board boundaries by ${overlapDistanceMm}mm.${repositionSuggestion ? ` ${repositionSuggestion}` : ""}`,
      pcb_component_id: c.pcb_component_id,
      pcb_board_id: board.pcb_board_id,
      component_center: c.center,
      component_bounds: {
        min_x: componentBox.xmin,
        max_x: componentBox.xmax,
        min_y: componentBox.ymin,
        max_y: componentBox.ymax,
      },
      subcircuit_id: c.subcircuit_id,
      source_component_id: c.source_component_id,
    })
  }

  return errors
}
