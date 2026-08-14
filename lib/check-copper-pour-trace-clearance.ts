import * as Flatten from "@flatten-js/core"
import {
  getReadableNameForElement,
  getPrimaryId,
} from "@tscircuit/circuit-json-util"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  PcbCopperPour,
  PcbTraceError,
} from "circuit-json"
import { formatMm } from "format-si-unit"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { getCopperPourPolygon } from "lib/check-copper-to-board-edge-clearance"
import { getPcbPortIdsConnectedToTraces } from "lib/check-each-pcb-trace-non-overlapping/getPcbPortIdsConnectedToTraces"
import {
  getTraceCenter,
  getTraceSegments,
  isTraceObstacleOverlap,
} from "lib/check-pad-clearance/common"
import { EPSILON, getBoardDrcValue, getPcbBoard } from "lib/drc-defaults"

const getTraceToCopperPourGap = ({
  segment,
  copperPour,
}: {
  segment: ReturnType<typeof getTraceSegments>[number]
  copperPour: PcbCopperPour
}): number | null => {
  const copperPourPolygon = getCopperPourPolygon(copperPour)
  if (!copperPourPolygon) return null

  const traceCenterLine = new Flatten.Segment(
    new Flatten.Point(segment.x1, segment.y1),
    new Flatten.Point(segment.x2, segment.y2),
  )
  const traceRadius = segment.thickness / 2
  const centerLineTouchesCopper =
    copperPourPolygon.intersect(traceCenterLine).length > 0 ||
    copperPourPolygon.contains(traceCenterLine.start) ||
    copperPourPolygon.contains(traceCenterLine.end)

  if (centerLineTouchesCopper) return -traceRadius
  return copperPourPolygon.distanceTo(traceCenterLine)[0] - traceRadius
}

const isTraceConnectedToCopperPour = ({
  traceId,
  sourceTraceId,
  copperPour,
  connectivityMap,
}: {
  traceId: string
  sourceTraceId?: string
  copperPour: PcbCopperPour
  connectivityMap: ConnectivityMap
}): boolean => {
  const traceConnectivityIds = [traceId, sourceTraceId].filter(
    (id): id is string => Boolean(id),
  )
  const pourConnectivityIds = [
    copperPour.pcb_copper_pour_id,
    copperPour.source_net_id,
  ].filter((id): id is string => Boolean(id))

  return traceConnectivityIds.some((traceConnectivityId) =>
    pourConnectivityIds.some((pourConnectivityId) =>
      connectivityMap.areIdsConnected(traceConnectivityId, pourConnectivityId),
    ),
  )
}

export function checkCopperPourTraceClearance(
  circuitJson: AnyCircuitElement[],
  {
    connectivityMap,
    minClearance,
  }: { connectivityMap?: ConnectivityMap; minClearance?: number } = {},
): PcbTraceError[] {
  const copperPours = circuitJson.filter(
    (element): element is PcbCopperPour => element.type === "pcb_copper_pour",
  )
  const traceSegments = getTraceSegments(circuitJson)
  if (copperPours.length === 0 || traceSegments.length === 0) return []

  const board = getPcbBoard(circuitJson)
  const requiredClearance =
    minClearance ??
    getBoardDrcValue(board, "min_trace_to_pad_edge_clearance") ??
    jlcMinTolerances.min_trace_to_pad_edge_clearance
  if (requiredClearance === undefined) return []
  connectivityMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)

  const traceErrorsByPair = new Map<
    string,
    { error: PcbTraceError; gap: number }
  >()

  for (const segment of traceSegments) {
    for (const copperPour of copperPours) {
      if (copperPour.layer !== segment.layer) continue
      if (
        isTraceConnectedToCopperPour({
          traceId: segment.pcb_trace_id,
          sourceTraceId: segment._pcbTrace.source_trace_id,
          copperPour,
          connectivityMap,
        })
      ) {
        continue
      }

      const gap = getTraceToCopperPourGap({ segment, copperPour })
      if (gap === null || gap + EPSILON >= requiredClearance) continue

      const pairId = `${segment.pcb_trace_id}_${copperPour.pcb_copper_pour_id}`
      const existingError = traceErrorsByPair.get(pairId)
      if (existingError && existingError.gap <= gap) continue

      const traceName = getReadableNameForElement(
        circuitJson,
        segment.pcb_trace_id,
      )
      const copperPourId = getPrimaryId(copperPour)
      const message = isTraceObstacleOverlap(gap)
        ? `PCB trace ${traceName} overlaps with pcb_copper_pour "${copperPourId}"`
        : `PCB trace ${traceName} is too close to pcb_copper_pour "${copperPourId}" (gap: ${formatMm(gap)}, minimum: ${formatMm(requiredClearance)})`

      traceErrorsByPair.set(pairId, {
        gap,
        error: {
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          pcb_trace_error_id: `copper_pour_clearance_${pairId}`,
          message,
          pcb_trace_id: segment.pcb_trace_id,
          source_trace_id: segment._pcbTrace.source_trace_id ?? "",
          center: getTraceCenter(segment),
          pcb_component_ids: [],
          pcb_port_ids: getPcbPortIdsConnectedToTraces([segment._pcbTrace]),
        },
      })
    }
  }

  return Array.from(traceErrorsByPair.values()).map(({ error }) => error)
}
