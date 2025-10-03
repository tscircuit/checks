import type {
  AnyCircuitElement,
  PcbBoard,
  PcbTrace,
  PcbTraceError,
} from "circuit-json"
import { cju } from "@tscircuit/circuit-json-util"
import type { Point, Polygon } from "@tscircuit/math-utils"
import {
  doSegmentsIntersect,
  onSegment,
  pointToSegmentDistance,
  isPointInsidePolygon,
} from "@tscircuit/math-utils"

/**
 * Default margin for trace clearance from board edge (in mm)
 */
const DEFAULT_BOARD_MARGIN = 0.2

/**
 * Configuration for trace board boundary checking
 */
export interface TraceBoardCheckConfig {
  /** Minimum distance from trace center to board edge (in mm) */
  margin?: number
}

/**
 * Create a board polygon representation using math-utils Polygon type
 */
function getBoardPolygonPoints(board: PcbBoard): Polygon | null {
  if (board.outline && board.outline.length > 0) {
    // Use custom board outline
    return board.outline.map((p) => ({ x: p.x, y: p.y }))
  }

  if (
    board.center &&
    typeof board.width === "number" &&
    typeof board.height === "number"
  ) {
    // Create rectangular board outline
    const cx = board.center.x
    const cy = board.center.y
    const hw = board.width / 2
    const hh = board.height / 2

    return [
      { x: cx - hw, y: cy - hh }, // bottom-left
      { x: cx + hw, y: cy - hh }, // bottom-right
      { x: cx + hw, y: cy + hh }, // top-right
      { x: cx - hw, y: cy + hh }, // top-left
    ]
  }

  return null
}

/**
 * Note: We use the isPointInsidePolygon function from @tscircuit/math-utils
 * which provides a well-tested implementation of the ray casting algorithm
 */

/**
 * Check if a line segment intersects with any edge of a polygon boundary
 * Uses @tscircuit/math-utils doSegmentsIntersect function
 */
function segmentIntersectsPolygonBoundary(
  segmentStart: Point,
  segmentEnd: Point,
  polygonPoints: Polygon,
): boolean {
  // Check intersection with each polygon edge using math-utils
  for (let i = 0; i < polygonPoints.length; i++) {
    const edgeStart = polygonPoints[i]
    const edgeEnd = polygonPoints[(i + 1) % polygonPoints.length]

    // Use math-utils doSegmentsIntersect function
    if (doSegmentsIntersect(segmentStart, segmentEnd, edgeStart, edgeEnd)) {
      // Additional check: avoid false positives when segment endpoints
      // are exactly on polygon boundary (which is acceptable)
      const startOnBoundary = onSegment(edgeStart, segmentStart, edgeEnd)
      const endOnBoundary = onSegment(edgeStart, segmentEnd, edgeEnd)

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
function pointToPolygonDistance(point: Point, polygonPoints: Polygon): number {
  let minDistance = Infinity

  // Check distance to each polygon edge using math-utils
  for (let i = 0; i < polygonPoints.length; i++) {
    const edgeStart = polygonPoints[i]
    const edgeEnd = polygonPoints[(i + 1) % polygonPoints.length]

    const distance = pointToSegmentDistance(point, edgeStart, edgeEnd)
    if (distance < minDistance) {
      minDistance = distance
    }
  }

  return minDistance
}

/**
 * Check if any trace segment leaves or intersects the board outline
 * Uses only @tscircuit/math-utils functions with configurable margin
 */
export function checkPcbTracesOutOfBoard(
  circuitJson: AnyCircuitElement[],
  config: TraceBoardCheckConfig = {},
): PcbTraceError[] {
  const errors: PcbTraceError[] = []
  const margin = config.margin ?? DEFAULT_BOARD_MARGIN

  // Find the board
  const board = circuitJson.find(
    (el): el is PcbBoard => el.type === "pcb_board",
  )
  if (!board) return errors

  // Create board polygon using math-utils Point type
  const boardPoints = getBoardPolygonPoints(board)
  if (!boardPoints) return errors

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
      const startInside = isPointInsidePolygon(segment.start, boardPoints)
      const endInside = isPointInsidePolygon(segment.end, boardPoints)

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
        segmentIntersectsPolygonBoundary(
          segment.start,
          segment.end,
          boardPoints,
        )
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

      // Check if trace gets too close to board edge (configurable margin)
      // This uses math-utils pointToSegmentDistance for precise measurements
      const midpoint: Point = {
        x: (segment.start.x + segment.end.x) / 2,
        y: (segment.start.y + segment.end.y) / 2,
      }
      const distanceToBoard = pointToPolygonDistance(midpoint, boardPoints)
      const minimumDistance = traceWidth / 2 + margin

      if (distanceToBoard < minimumDistance) {
        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          pcb_trace_error_id: `trace_too_close_to_board_${trace.pcb_trace_id}_segment_${i}`,
          message: `Trace too close to board edge (${distanceToBoard.toFixed(3)}mm < ${minimumDistance.toFixed(3)}mm required, margin: ${margin}mm)`,
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
