import {
  getPrimaryId,
  getReadableNameForElement,
} from "@tscircuit/circuit-json-util"
import {
  segmentToBoundsMinDistance,
  segmentToCircleMinDistance,
} from "@tscircuit/math-utils"
import type { AnyCircuitElement, PcbPadTraceClearanceError } from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { getCollidableBounds } from "lib/check-each-pcb-trace-non-overlapping/getCollidableBounds"
import { SpatialObjectIndex } from "lib/data-structures/SpatialIndex"
import { DEFAULT_PAD_TRACE_CLEARANCE, EPSILON } from "lib/drc-defaults"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import {
  type PadElement,
  formatMm,
  getPadBounds,
  getPadCenter,
  getPadRadius,
  getPads,
  getTraceSegments,
  isCircularPad,
} from "./check-pad-clearance/common"

export function checkPadTraceClearance(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minClearance = DEFAULT_PAD_TRACE_CLEARANCE,
  }: { connMap?: ConnectivityMap; minClearance?: number } = {},
): PcbPadTraceClearanceError[] {
  const pads = getPads(circuitJson)
  const segments = getTraceSegments(circuitJson)
  if (pads.length === 0 || segments.length === 0) return []

  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
  const spatialIndex = new SpatialObjectIndex<PadElement>({
    objects: pads,
    getBounds: getPadBounds,
    getId: (pad) => getPrimaryId(pad),
  })

  const errors = new Map<
    string,
    { error: PcbPadTraceClearanceError; gap: number }
  >()

  for (const segment of segments) {
    const nearbyPads = spatialIndex.getObjectsInBounds(
      getCollidableBounds(segment),
      minClearance! + segment.thickness / 2,
    )

    for (const pad of nearbyPads) {
      const padId = getPrimaryId(pad)
      if (!getLayersOfPcbElement(pad as any).includes(segment.layer)) continue
      if (connMap.areIdsConnected(segment.pcb_trace_id, padId)) continue
      const center = getPadCenter(pad)

      const gap = isCircularPad(pad)
        ? segmentToCircleMinDistance(
            { x: segment.x1, y: segment.y1 },
            { x: segment.x2, y: segment.y2 },
            { x: center.x, y: center.y, radius: getPadRadius(pad) },
          ) -
          segment.thickness / 2
        : segmentToBoundsMinDistance(
            { x: segment.x1, y: segment.y1 },
            { x: segment.x2, y: segment.y2 },
            getPadBounds(pad),
          ) -
          segment.thickness / 2
      if (gap + EPSILON >= minClearance!) continue

      const pairId = `${padId}_${segment.pcb_trace_id}`
      const nextError: PcbPadTraceClearanceError = {
        type: "pcb_pad_trace_clearance_error" as const,
        pcb_pad_trace_clearance_error_id: `pad_trace_clearance_${pairId}`,
        error_type: "pcb_pad_trace_clearance_error",
        message: `Pad ${getReadableNameForElement(circuitJson, padId)} and trace ${getReadableNameForElement(circuitJson, segment.pcb_trace_id)} are too close (clearance: ${formatMm(gap)}, minimum: ${formatMm(minClearance!)})`,
        pcb_pad_id: padId,
        pcb_trace_id: segment.pcb_trace_id,
        minimum_clearance: minClearance,
        actual_clearance: gap,
        center: {
          x: (center.x + (segment.x1 + segment.x2) / 2) / 2,
          y: (center.y + (segment.y1 + segment.y2) / 2) / 2,
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
