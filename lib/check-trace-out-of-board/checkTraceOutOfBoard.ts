import type {
  AnyCircuitElement,
  PcbBoard,
  PcbTrace,
  PcbTraceError,
} from "circuit-json"
import { cju } from "@tscircuit/circuit-json-util"
import type { Point, Polygon } from "@tscircuit/math-utils"
import { segmentToSegmentMinDistance } from "@tscircuit/math-utils"

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
 * Check if any trace segment is too close to or outside the board outline
 * Uses segment-to-polygon distance with configurable margin
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

      const traceWidth =
        "width" in p1 ? p1.width : "width" in p2 ? p2.width : 0.1
      const segmentStart: Point = { x: p1.x, y: p1.y }
      const segmentEnd: Point = { x: p2.x, y: p2.y }

      // Calculate minimum distance from trace segment to board polygon
      let minDistance = Infinity
      for (let j = 0; j < boardPoints.length; j++) {
        const edgeStart = boardPoints[j]
        const edgeEnd = boardPoints[(j + 1) % boardPoints.length]
        const distance = segmentToSegmentMinDistance(
          segmentStart,
          segmentEnd,
          edgeStart,
          edgeEnd,
        )
        if (distance < minDistance) {
          minDistance = distance
        }
      }

      const minimumDistance = traceWidth / 2 + margin

      if (minDistance < minimumDistance) {
        const error: PcbTraceError = {
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          pcb_trace_error_id: `trace_too_close_to_board_${trace.pcb_trace_id}_segment_${i}`,
          message: `Trace too close to board edge (${minDistance.toFixed(3)}mm < ${minimumDistance.toFixed(3)}mm required, margin: ${margin}mm)`,
          pcb_trace_id: trace.pcb_trace_id,
          source_trace_id: trace.source_trace_id || "",
          center: {
            x: (segmentStart.x + segmentEnd.x) / 2,
            y: (segmentStart.y + segmentEnd.y) / 2,
          },
          pcb_component_ids: [],
          pcb_port_ids: [],
        }
        errors.push(error)
      }
    }
  }

  return errors
}
