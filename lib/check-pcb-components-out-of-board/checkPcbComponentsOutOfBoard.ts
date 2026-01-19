import type {
  AnyCircuitElement,
  PcbBoard,
  PcbComponent,
  AnySourceComponent,
  PcbComponentOutsideBoardError,
  SourceGroup,
  SourceBoard,
} from "circuit-json"
import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import type { Point } from "@tscircuit/math-utils"
import * as Flatten from "@flatten-js/core"
import { rotateDEG, applyToPoint } from "transformation-matrix"
import { findBoardForElement } from "lib/util/findBoardForElement"
import { boardToPolygon } from "lib/util/boardToPolygon"

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

  return (
    getReadableNameForElement(circuitJson, component.pcb_component_id) ||
    "Unknown"
  )
}

/**
 * Compute overlap distance based on polygon containment and distances.
 * - If component center is outside board, distance is from center to board polygon.
 * - Samples rotated rectangle corners and edge midpoints; for any outside points,
 *   computes distance to board polygon and returns the maximum.
 * - Falls back to intersection area ratio heuristic if needed.
 * - Returns small epsilon if fully inside.
 */
function computeOverlapDistance(
  compPoly: Flatten.Polygon,
  boardPoly: Flatten.Polygon,
  componentCenter: Point,
  componentWidth: number,
  componentHeight: number,
  rotationDeg: number,
): number {
  const centerPoint = new Flatten.Point(componentCenter.x, componentCenter.y)
  // If center is outside board polygon, return distance to board polygon
  if (!boardPoly.contains(centerPoint)) {
    const dist = boardPoly.distanceTo(centerPoint)
    return Array.isArray(dist) ? dist[0] : Number(dist) || 0
  }

  // Sample corners and edge midpoints of rotated rectangle
  const hw = componentWidth / 2
  const hh = componentHeight / 2

  // Original corners
  const corners: Point[] = [
    { x: componentCenter.x - hw, y: componentCenter.y - hh },
    { x: componentCenter.x + hw, y: componentCenter.y - hh },
    { x: componentCenter.x + hw, y: componentCenter.y + hh },
    { x: componentCenter.x - hw, y: componentCenter.y + hh },
  ]

  // Edge midpoints
  const midpoints: Point[] = []
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4
    midpoints.push({
      x: (corners[i].x + corners[next].x) / 2,
      y: (corners[i].y + corners[next].y) / 2,
    })
  }

  // Rotate points around center by rotationDeg
  const matrix = rotateDEG(rotationDeg, componentCenter.x, componentCenter.y)
  const rotatePoint = (pt: Point) => {
    const p = applyToPoint(matrix, pt)
    return new Flatten.Point(p.x, p.y)
  }

  const rotatedPoints = corners.concat(midpoints).map(rotatePoint)

  // For any point outside board polygon, compute distance to board polygon
  let maxDistance = 0
  for (const pt of rotatedPoints) {
    if (!boardPoly.contains(pt)) {
      const dist = boardPoly.distanceTo(pt)
      const d = Array.isArray(dist) ? dist[0] : Number(dist) || 0
      if (d > maxDistance) maxDistance = d
    }
  }

  if (maxDistance > 0) {
    return maxDistance
  }

  // Fallback: use intersection area ratio heuristic
  try {
    const intersection = Flatten.BooleanOperations.intersect(
      compPoly,
      boardPoly,
    )

    let intersectionArea = 0
    if (!intersection) {
      intersectionArea = 0
    } else if (Array.isArray(intersection)) {
      intersectionArea = intersection.reduce(
        (sum, p) => sum + (typeof p.area === "function" ? p.area() : 0),
        0,
      )
    } else if (typeof (intersection as any).area === "function") {
      intersectionArea = (intersection as any).area()
    } else {
      intersectionArea = 0
    }

    const compArea = compPoly.area()

    if (intersectionArea > 0 && intersectionArea < compArea) {
      const overlapRatio = 1 - intersectionArea / compArea
      const compWidth = Math.abs(componentWidth)
      const compHeight = Math.abs(componentHeight)
      return Math.min(compWidth, compHeight) * overlapRatio
    }
    // completely outside or fully inside (should not happen here), return small epsilon
    return 0.1
  } catch {
    // If boolean ops fail (unlikely), return small epsilon
    return 0.1
  }
}

/**
 * Main function — polygon-first: construct polygons, test containment / intersection,
 * compute overlap distance using boolean intersection area or geometric distance.
 *
 * For panels with multiple boards, each component is checked against its own board
 * (determined by subcircuit_id relationships). For single-board circuits, all
 * components are checked against that board.
 */
export function checkPcbComponentsOutOfBoard(
  circuitJson: AnyCircuitElement[],
): PcbComponentOutsideBoardError[] {
  const boards = circuitJson.filter(
    (el): el is PcbBoard => el.type === "pcb_board",
  )
  if (boards.length === 0) return []

  const components = circuitJson.filter(
    (el): el is PcbComponent => el.type === "pcb_component",
  )
  if (components.length === 0) return []

  const boardPolygons = new Map<string, Flatten.Polygon>()
  for (const board of boards) {
    const poly = boardToPolygon(board)
    if (poly) {
      boardPolygons.set(board.pcb_board_id, poly)
    }
  }

  const singleBoard = boards.length === 1 ? boards[0] : null
  const singleBoardPoly = singleBoard
    ? boardPolygons.get(singleBoard.pcb_board_id)
    : null

  const errors: PcbComponentOutsideBoardError[] = []

  for (const c of components) {
    // need center, width, height
    if (
      !c.center ||
      typeof c.width !== "number" ||
      typeof c.height !== "number"
    )
      continue

    if (c.width <= 0 || c.height <= 0) continue

    // Find the board this component belongs to
    let board: PcbBoard | null = null
    let boardPoly: Flatten.Polygon | null | undefined = null

    if (singleBoard && singleBoardPoly) {
      // Single board case - use it for all components
      board = singleBoard
      boardPoly = singleBoardPoly
    } else {
      // Multiple boards - find the component's specific board
      board = findBoardForElement(circuitJson, c)
      if (board) {
        boardPoly = boardPolygons.get(board.pcb_board_id)
      }
    }

    // If we can't find a board for this component, skip it
    if (!board || !boardPoly) continue

    const compPoly = rectanglePolygon({
      center: c.center,
      size: { width: c.width, height: c.height },
      rotationDeg: c.rotation || 0,
    })

    if (compPoly.area() === 0) continue

    // If component is entirely inside board polygon -> OK
    // Flatten.Polygon.contains accepts shapes; this is the correct polygon containment check.
    const isInside = boardPoly.contains(compPoly)
    if (isInside) continue

    // Component is at least partially outside. Compute overlapDistance:
    const overlapDistance = computeOverlapDistance(
      compPoly,
      boardPoly,
      c.center,
      c.width,
      c.height,
      c.rotation || 0,
    )

    const compName = getComponentName({ circuitJson, component: c })
    const overlapDistanceMm = Math.round(overlapDistance * 100) / 100

    errors.push({
      type: "pcb_component_outside_board_error",
      error_type: "pcb_component_outside_board_error",
      pcb_component_outside_board_error_id: `pcb_component_outside_board_${c.pcb_component_id}`,
      message: `Component ${compName} (${c.pcb_component_id}) extends outside board boundaries by ${overlapDistanceMm}mm`,
      pcb_component_id: c.pcb_component_id,
      pcb_board_id: board.pcb_board_id,
      component_center: c.center,
      component_bounds: {
        min_x: compPoly.box.xmin,
        max_x: compPoly.box.xmax,
        min_y: compPoly.box.ymin,
        max_y: compPoly.box.ymax,
      },
      subcircuit_id: c.subcircuit_id,
      source_component_id: c.source_component_id,
    })
  }

  return errors
}
