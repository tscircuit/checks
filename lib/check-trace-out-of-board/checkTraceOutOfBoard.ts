import { cju } from "@tscircuit/circuit-json-util"
import { convertCircuitJsonToFlattenJs } from "@tscircuit/circuit-json-to-flattenjs"
import type { Point, Polygon } from "@tscircuit/math-utils"
import {
  isPointInsidePolygon,
  segmentToSegmentMinDistance,
} from "@tscircuit/math-utils"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbTrace,
  PcbTraceError,
} from "circuit-json"
import { getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"

const GEOMETRY_EPSILON = 1e-9

/**
 * Configuration for trace board boundary checking
 */
export interface TraceBoardCheckConfig {
  /** Minimum distance from trace copper to board edge (in mm) */
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

function checkInterpolatedTrace({
  board,
  trace,
  margin,
}: {
  board: PcbBoard
  trace: PcbTrace
  margin: number
}): PcbTraceError[] {
  // A taper has flat end caps and joined bends. A centerline buffer using either
  // endpoint width can both miss real violations and reject legal copper.
  const { elements } = convertCircuitJsonToFlattenJs([board, trace], {
    elementTypes: ["pcb_board", "pcb_trace"],
    includeDrillHoles: false,
    strict: true,
  })
  const boardPolygon = elements.find(
    (element) => element.elementType === "pcb_board",
  )?.shapes[0]
  if (!boardPolygon) return []

  for (const geometry of elements) {
    if (geometry.elementType !== "pcb_trace") continue
    for (const shape of geometry.shapes) {
      const isInside = boardPolygon.contains(shape)
      const clearance = isInside ? boardPolygon.distanceTo(shape)[0] : 0
      if (isInside && clearance + GEOMETRY_EPSILON >= margin) continue

      return [
        {
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          pcb_trace_error_id: `trace_too_close_to_board_${trace.pcb_trace_id}_interpolated`,
          message: isInside
            ? `Trace copper too close to board edge (${clearance.toFixed(3)}mm < ${margin.toFixed(3)}mm required)`
            : "Trace copper is outside board outline",
          pcb_trace_id: trace.pcb_trace_id,
          source_trace_id: trace.source_trace_id || "",
          center: {
            x: (shape.box.xmin + shape.box.xmax) / 2,
            y: (shape.box.ymin + shape.box.ymax) / 2,
          },
          pcb_component_ids: [],
          pcb_port_ids: [],
        },
      ]
    }
  }
  return []
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
  const board = getPcbBoard(circuitJson)
  if (!board) return errors
  const margin =
    config.margin ??
    getBoardDrcValue(board, "min_board_edge_clearance") ??
    jlcMinTolerances.min_board_edge_clearance
  const boardPoints = getBoardPolygonPoints(board)
  if (!boardPoints) return errors

  // Get all PCB traces
  const pcbTraces = cju(circuitJson).pcb_trace.list()

  for (const trace of pcbTraces) {
    if (trace.route.length < 2) continue
    if (trace.route_thickness_mode === "interpolated") {
      errors.push(...checkInterpolatedTrace({ board, trace, margin: margin! }))
      continue
    }

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
      let minDistance = Number.POSITIVE_INFINITY
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

      const minimumDistance = traceWidth / 2 + margin!

      // Distance alone is unsigned: a segment entirely outside the board can be
      // far from every edge. Still check edge distance for segments that cross
      // a concave notch even though both endpoints are inside.
      const isOutside =
        !isPointInsidePolygon(segmentStart, boardPoints) ||
        !isPointInsidePolygon(segmentEnd, boardPoints)

      if (isOutside || minDistance + GEOMETRY_EPSILON < minimumDistance) {
        const error: PcbTraceError = {
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          pcb_trace_error_id: `trace_too_close_to_board_${trace.pcb_trace_id}_segment_${i}`,
          message: isOutside
            ? "Trace is outside board outline"
            : `Trace too close to board edge (${minDistance.toFixed(3)}mm < ${minimumDistance.toFixed(3)}mm required, margin: ${margin}mm)`,
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
