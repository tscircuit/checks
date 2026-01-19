import * as Flatten from "@flatten-js/core"
import type { PcbBoard } from "circuit-json"

/**
 * Check if a polygon has counter-clockwise winding order.
 */
function isPolygonCCW(poly: Flatten.Polygon): boolean {
  // @ts-ignore
  return poly.area() >= 0
}

/**
 * Convert a PcbBoard to a Flatten.Polygon, supporting both outline and rectangular boards.
 * Returns null if the board cannot be converted to a polygon.
 */
export function boardToPolygon(board: PcbBoard): Flatten.Polygon | null {
  // If board has an outline, use it
  if (board.outline && board.outline.length > 0) {
    const points = board.outline.map((p) => new Flatten.Point(p.x, p.y))
    const poly = new Flatten.Polygon(points)

    // Ensure CCW order
    if (!isPolygonCCW(poly)) {
      poly.reverse()
    }

    return poly
  }

  // Otherwise, create a rectangle from center/width/height
  if (
    board.center &&
    typeof board.width === "number" &&
    typeof board.height === "number"
  ) {
    const cx = board.center.x
    const cy = board.center.y
    const hw = board.width / 2
    const hh = board.height / 2

    const corners = [
      new Flatten.Point(cx - hw, cy - hh),
      new Flatten.Point(cx + hw, cy - hh),
      new Flatten.Point(cx + hw, cy + hh),
      new Flatten.Point(cx - hw, cy + hh),
    ]

    const poly = new Flatten.Polygon(corners)

    // Ensure CCW order
    if (!isPolygonCCW(poly)) {
      poly.reverse()
    }

    return poly
  }

  return null
}
