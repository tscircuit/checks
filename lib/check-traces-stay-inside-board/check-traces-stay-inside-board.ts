import type {
  AnyCircuitElement,
  PcbBoard,
  PcbTrace,
  PcbTraceError,
} from "circuit-json"
import { cju } from "@tscircuit/circuit-json-util"
import type { Point } from "@tscircuit/math-utils"
import {
  doSegmentsIntersect,
  onSegment,
  pointToSegmentDistance,
} from "@tscircuit/math-utils"
import * as Flatten from "@flatten-js/core"

/**
 * Create a board polygon from the PcbBoard element
 */
function boardToPolygon(board: PcbBoard): Flatten.Polygon | null {
  if (board.outline && board.outline.length > 0) {
    const points = board.outline.map((p) => new Flatten.Point(p.x, p.y))
    const poly = new Flatten.Polygon(points)

    // Ensure CCW order (positive area in Flatten.js)
    if (poly.area() < 0) {
      poly.reverse()
    }

    return poly
  }

  if (
    board.center &&
    typeof board.width === "number" &&
    typeof board.height === "number"
  ) {
    const cx = board.center.x
    const cy = board.center.y
    const hw = board.width / 2
    const hh = board.height / 2

    const corners: Flatten.Point[] = [
      new Flatten.Point(cx - hw, cy - hh),
      new Flatten.Point(cx + hw, cy - hh),
      new Flatten.Point(cx + hw, cy + hh),
      new Flatten.Point(cx - hw, cy + hh),
    ]

    const poly = new Flatten.Polygon(corners)
    if (poly.area() < 0) {
      poly.reverse()
    }
    return poly
  }

  return null
}

/**
 * Check if a point is inside a polygon using point-in-polygon test
 */
function isPointInsidePolygon(point: Point, polygon: Flatten.Polygon): boolean {
  const flattenPoint = new Flatten.Point(point.x, point.y)
  return polygon.contains(flattenPoint)
}

/**
 * Check if a line segment intersects with any edge of a polygon boundary
 * Uses @tscircuit/math-utils doSegmentsIntersect function
 */
function segmentIntersectsPolygonBoundary(
  segmentStart: Point,
  segmentEnd: Point,
  polygon: Flatten.Polygon,
): boolean {
  // Check intersection with each polygon edge using math-utils
  for (const edge of polygon.edges) {
    const edgeStart: Point = { x: edge.start.x, y: edge.start.y }
    const edgeEnd: Point = { x: edge.end.x, y: edge.end.y }

    // Use math-utils doSegmentsIntersect function
    if (doSegmentsIntersect(segmentStart, segmentEnd, edgeStart, edgeEnd)) {
      // Additional check: avoid false positives when segment endpoints
      // are exactly on polygon boundary (which is acceptable)
      const startOnBoundary =
        onSegment(edgeStart, segmentStart, edgeEnd) ||
        onSegment(edgeEnd, segmentStart, edgeStart)
      const endOnBoundary =
        onSegment(edgeStart, segmentEnd, edgeEnd) ||
        onSegment(edgeEnd, segmentEnd, edgeStart)

      // Only report intersection if it's a proper crossing, not just touching at endpoints
      if (!startOnBoundary && !endOnBoundary) {
        return true
      }
    }
  }
  return false
}

/**
 * Get minimum distance from a point to polygon boundary
 * Uses @tscircuit/math-utils pointToSegmentDistance function
 */
function pointToPolygonDistance(
  point: Point,
  polygon: Flatten.Polygon,
): number {
  let minDistance = Infinity

  // Check distance to each polygon edge using math-utils
  for (const edge of polygon.edges) {
    const edgeStart: Point = { x: edge.start.x, y: edge.start.y }
    const edgeEnd: Point = { x: edge.end.x, y: edge.end.y }

    const distance = pointToSegmentDistance(point, edgeStart, edgeEnd)
    if (distance < minDistance) {
      minDistance = distance
    }
  }

  return minDistance
}

/**
 * Check if any trace segment leaves or intersects the board outline
 */
export function checkTracesStayInsideBoard(
  circuitJson: AnyCircuitElement[],
): PcbTraceError[] {
  const errors: PcbTraceError[] = []

  // Find the board
  const board = circuitJson.find(
    (el): el is PcbBoard => el.type === "pcb_board",
  )
  if (!board) return errors

  // Create board polygon
  const boardPoly = boardToPolygon(board)
  if (!boardPoly) return errors

  // Get all PCB traces
  const pcbTraces = cju(circuitJson).pcb_trace.list()

  for (const trace of pcbTraces) {
    if (trace.route.length < 2) continue

    // Check each segment of the trace
    for (let i = 0; i < trace.route.length - 1; i++) {
      const p1 = trace.route[i]
      const p2 = trace.route[i + 1]

      // Only check wire segments
      if (p1.route_type !== "wire" || p2.route_type !== "wire") continue

      const segment = {
        start: { x: p1.x, y: p1.y },
        end: { x: p2.x, y: p2.y },
      }

      const traceWidth =
        "width" in p1 ? p1.width : "width" in p2 ? p2.width : 0.1

      // Check if both endpoints are inside the board
      const startInside = isPointInsidePolygon(segment.start, boardPoly)
      const endInside = isPointInsidePolygon(segment.end, boardPoly)

      // If either endpoint is outside the board, it's a violation
      if (!startInside || !endInside) {
        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          pcb_trace_error_id: `trace_outside_board_${trace.pcb_trace_id}_segment_${i}`,
          message: `Trace extends outside board boundaries`,
          pcb_trace_id: trace.pcb_trace_id,
          source_trace_id: trace.source_trace_id || "",
          center: {
            x: (segment.start.x + segment.end.x) / 2,
            y: (segment.start.y + segment.end.y) / 2,
          },
          pcb_component_ids: [],
          pcb_port_ids: [],
        })
        continue
      }

      // If both endpoints are inside, check if segment crosses board boundary
      // This uses math-utils doSegmentsIntersect to catch traces that exit and re-enter
      if (
        segmentIntersectsPolygonBoundary(segment.start, segment.end, boardPoly)
      ) {
        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          pcb_trace_error_id: `trace_crosses_board_${trace.pcb_trace_id}_segment_${i}`,
          message: `Trace crosses board boundaries`,
          pcb_trace_id: trace.pcb_trace_id,
          source_trace_id: trace.source_trace_id || "",
          center: {
            x: (segment.start.x + segment.end.x) / 2,
            y: (segment.start.y + segment.end.y) / 2,
          },
          pcb_component_ids: [],
          pcb_port_ids: [],
        })
        continue
      }

      // Optional: Check if trace gets too close to board edge (considering trace width)
      // This uses math-utils pointToSegmentDistance for precise measurements
      const midpoint: Point = {
        x: (segment.start.x + segment.end.x) / 2,
        y: (segment.start.y + segment.end.y) / 2,
      }
      const distanceToBoard = pointToPolygonDistance(midpoint, boardPoly)
      const minimumDistance = traceWidth / 2 + 0.05 // 0.05mm minimum clearance

      if (distanceToBoard < minimumDistance) {
        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          pcb_trace_error_id: `trace_too_close_to_board_${trace.pcb_trace_id}_segment_${i}`,
          message: `Trace too close to board edge (${distanceToBoard.toFixed(3)}mm < ${minimumDistance.toFixed(3)}mm required)`,
          pcb_trace_id: trace.pcb_trace_id,
          source_trace_id: trace.source_trace_id || "",
          center: midpoint,
          pcb_component_ids: [],
          pcb_port_ids: [],
        })
      }
    }
  }

  return errors
}
