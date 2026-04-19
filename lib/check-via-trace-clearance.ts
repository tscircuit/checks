import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import { segmentToCircleMinDistance } from "@tscircuit/math-utils"
import type {
  AnyCircuitElement,
  PcbVia,
  PcbViaTraceClearanceError,
} from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { DEFAULT_PAD_TRACE_CLEARANCE, EPSILON } from "lib/drc-defaults"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import { formatMm, getTraceSegments } from "./check-pad-clearance/common"

const getClosestPointOnSegment = (
  point: { x: number; y: number },
  segmentStart: { x: number; y: number },
  segmentEnd: { x: number; y: number },
) => {
  const dx = segmentEnd.x - segmentStart.x
  const dy = segmentEnd.y - segmentStart.y
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) return segmentStart

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) /
        lengthSquared,
    ),
  )

  return {
    x: segmentStart.x + t * dx,
    y: segmentStart.y + t * dy,
  }
}

export function checkViaTraceClearance(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minSpacing = DEFAULT_PAD_TRACE_CLEARANCE,
  }: { connMap?: ConnectivityMap; minSpacing?: number } = {},
): PcbViaTraceClearanceError[] {
  const vias = circuitJson.filter((el) => el.type === "pcb_via") as PcbVia[]
  const segments = getTraceSegments(circuitJson)
  if (vias.length === 0 || segments.length === 0) return []

  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
  const errors = new Map<
    string,
    { error: PcbViaTraceClearanceError; gap: number }
  >()

  for (const via of vias) {
    const viaRadius = via.outer_diameter / 2
    for (const segment of segments) {
      if (!getLayersOfPcbElement(via).includes(segment.layer)) continue
      if (connMap.areIdsConnected(segment.pcb_trace_id, via.pcb_via_id))
        continue

      const gap =
        segmentToCircleMinDistance(
          { x: segment.x1, y: segment.y1 },
          { x: segment.x2, y: segment.y2 },
          {
            x: via.x,
            y: via.y,
            radius: viaRadius,
          },
        ) -
        segment.thickness / 2
      if (gap + EPSILON >= minSpacing) continue

      const closestPoint = getClosestPointOnSegment(
        { x: via.x, y: via.y },
        { x: segment.x1, y: segment.y1 },
        { x: segment.x2, y: segment.y2 },
      )

      const pairId = `${via.pcb_via_id}_${segment.pcb_trace_id}`
      const nextError: PcbViaTraceClearanceError = {
        type: "pcb_via_trace_clearance_error",
        pcb_via_trace_clearance_error_id: `via_trace_clearance_${pairId}`,
        error_type: "pcb_via_trace_clearance_error",
        message: `Via ${getReadableNameForElement(circuitJson, via.pcb_via_id)} and trace ${getReadableNameForElement(circuitJson, segment.pcb_trace_id)} are too close (clearance: ${formatMm(gap)}, minimum: ${formatMm(minSpacing)})`,
        pcb_via_id: via.pcb_via_id,
        pcb_trace_id: segment.pcb_trace_id,
        minimum_clearance: minSpacing,
        actual_clearance: gap,
        center: {
          x: (via.x + closestPoint.x) / 2,
          y: (via.y + closestPoint.y) / 2,
        },
      }

      const current = errors.get(pairId)
      if (!current || gap < current.gap) {
        errors.set(pairId, { error: nextError, gap })
      }
    }
  }

  return Array.from(errors.values()).map(({ error }) => error)
}
