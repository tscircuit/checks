import type { AnyCircuitElement, PcbTraceError } from "circuit-json"
import { getReadableNameForElement, cju } from "@tscircuit/circuit-json-util"
import {
  SpatialObjectIndex,
  type Bounds,
} from "lib/data-structures/SpatialIndex"
import {
  getFullConnectivityMapFromCircuitJson,
  type ConnectivityMap,
} from "circuit-json-to-connectivity-map"
import {
  getCollidableBounds,
  type Collidable,
  type PcbTraceSegment,
} from "./getCollidableBounds"
import { segmentToBoundsMinDistance } from "@tscircuit/math-utils"
import {
  DEFAULT_TRACE_MARGIN,
  DEFAULT_TRACE_THICKNESS,
  EPSILON,
} from "lib/drc-defaults"
import { getPcbPortIdsConnectedToTraces } from "./getPcbPortIdsConnectedToTraces"
import { segmentToSegmentMinDistance } from "@tscircuit/math-utils"
import { areBoundsOverlapping } from "./areBoundsOverlapping"
import { getPrimaryId } from "@tscircuit/circuit-json-util"
import { getCenterOfBoundsPair } from "./getCenterOfBoundsPair"
import { getCenterOfPcbTraceSegments } from "./getCenterOfPcbTraceSegments"
import { getCenterOfBounds } from "./getCenterOfBounds"

export function checkEachPcbTraceNonOverlapping(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
  }: {
    connMap?: ConnectivityMap
  } = {},
): PcbTraceError[] {
  const errors: PcbTraceError[] = []
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)

  const pcbTraces = cju(circuitJson).pcb_trace.list()
  const pcbTraceSegments = pcbTraces.flatMap((pcbTrace) => {
    const segments: PcbTraceSegment[] = []
    for (let i = 0; i < pcbTrace.route.length - 1; i++) {
      const p1 = pcbTrace.route[i]
      const p2 = pcbTrace.route[i + 1]
      segments.push({
        type: "pcb_trace_segment",
        pcb_trace_id: pcbTrace.pcb_trace_id,
        _pcbTrace: pcbTrace,
        thickness:
          "width" in p1
            ? p1.width
            : "width" in p2
              ? p2.width
              : DEFAULT_TRACE_THICKNESS,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
      } as PcbTraceSegment)
    }
    return segments
  })
  const pcbSmtPads = cju(circuitJson).pcb_smtpad.list()
  const pcbPlatedHoles = cju(circuitJson).pcb_plated_hole.list()
  const pcbHoles = cju(circuitJson).pcb_hole.list()
  const pcbVias = cju(circuitJson).pcb_via.list()
  const pcbKeepouts = cju(circuitJson).pcb_keepout.list()

  const allObjects: Collidable[] = [
    ...pcbTraceSegments,
    ...pcbSmtPads,
    ...pcbPlatedHoles,
    ...pcbHoles,
    ...pcbVias,
    ...pcbKeepouts,
  ]

  const spatialIndex = new SpatialObjectIndex<Collidable>({
    objects: allObjects,
    getBounds: getCollidableBounds,
  })

  const getReadableName = (id: string) =>
    getReadableNameForElement(circuitJson, id)

  const errorIds = new Set<string>()

  // For each segment, check it if overlaps with anything collidable
  for (const segmentA of pcbTraceSegments) {
    const requiredMargin = DEFAULT_TRACE_MARGIN
    const bounds = getCollidableBounds(segmentA)
    const nearbyObjects = spatialIndex.getObjectsInBounds(
      bounds,
      requiredMargin + segmentA.thickness / 2,
    )
    if (segmentA.x1 === segmentA.x2 && segmentA.y1 === segmentA.y2) continue
    if (
      segmentA.pcb_trace_id === "pcb_trace_0" &&
      segmentA.x1 < 0 &&
      Math.min(segmentA.y1, segmentA.y2) < 0 &&
      segmentA.y2 === 3
    ) {
      console.log(
        { x1: segmentA.x1, y1: segmentA.y1, x2: segmentA.x2, y2: segmentA.y2 },
        nearbyObjects.length,
        { margin: requiredMargin + segmentA.thickness / 2, bounds },
      )
    }

    for (const obj of nearbyObjects) {
      if (obj.type === "pcb_trace_segment") {
        const segmentB = obj
        // Check if the segments are overlapping
        if (
          connMap.areIdsConnected(segmentA.pcb_trace_id, segmentB.pcb_trace_id)
        )
          continue

        if (
          segmentToSegmentMinDistance(
            { x: segmentA.x1, y: segmentA.y1 },
            { x: segmentA.x2, y: segmentA.y2 },
            { x: segmentB.x1, y: segmentB.y1 },
            { x: segmentB.x2, y: segmentB.y2 },
          ) -
            segmentA.thickness / 2 -
            segmentB.thickness / 2 >
          DEFAULT_TRACE_MARGIN - EPSILON
        )
          continue

        const pcb_trace_error_id = `overlap_${segmentA.pcb_trace_id}_${segmentB.pcb_trace_id}`
        const pcb_trace_error_id_reverse = `overlap_${segmentB.pcb_trace_id}_${segmentA.pcb_trace_id}`
        if (errorIds.has(pcb_trace_error_id)) continue
        if (errorIds.has(pcb_trace_error_id_reverse)) continue

        errorIds.add(pcb_trace_error_id)
        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          message: `PCB trace ${getReadableName(segmentA.pcb_trace_id)} overlaps with ${getReadableName(segmentB.pcb_trace_id)}`,
          pcb_trace_id: segmentA.pcb_trace_id,
          source_trace_id: "",
          pcb_trace_error_id,
          pcb_component_ids: [],
          center: getCenterOfPcbTraceSegments(segmentA, segmentB),
          pcb_port_ids: getPcbPortIdsConnectedToTraces([
            segmentA._pcbTrace,
            segmentB._pcbTrace,
          ]),
        })
        continue
      }
      const primaryObjId = getPrimaryId(obj as any)
      const gap =
        segmentToBoundsMinDistance(
          { x: segmentA.x1, y: segmentA.y1 },
          { x: segmentA.x2, y: segmentA.y2 },
          getCollidableBounds(obj),
        ) -
        segmentA.thickness / 2
      if (segmentA.pcb_trace_id === "pcb_trace_0") {
        console.log(
          getReadableName(segmentA.pcb_trace_id),
          getReadableName(primaryObjId),
          gap,
          requiredMargin,
        )
      }
      if (
        !connMap.areIdsConnected(segmentA.pcb_trace_id, primaryObjId) &&
        gap + EPSILON < requiredMargin
      ) {
        const pcb_trace_error_id = `overlap_${segmentA.pcb_trace_id}_${primaryObjId}`
        if (errorIds.has(pcb_trace_error_id)) continue
        errorIds.add(pcb_trace_error_id)
        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          message: `PCB trace ${getReadableName(segmentA.pcb_trace_id)} overlaps with ${obj.type} "${getReadableName(getPrimaryId(obj as any))}" ${gap < 0 ? "(accidental contact)" : `(gap: ${gap.toFixed(3)}mm)`}`,
          pcb_trace_id: segmentA.pcb_trace_id,
          source_trace_id: "",
          pcb_trace_error_id,
          pcb_component_ids: [
            "pcb_component_id" in obj ? obj.pcb_component_id : undefined,
          ].filter(Boolean) as string[],
          center: getCenterOfBounds(getCollidableBounds(obj)),
          pcb_port_ids: [
            ...getPcbPortIdsConnectedToTraces([segmentA._pcbTrace]),
            "pcb_port_id" in obj ? obj.pcb_port_id : undefined,
          ].filter(Boolean) as string[],
        })
      }
    }
  }
  return errors
}
