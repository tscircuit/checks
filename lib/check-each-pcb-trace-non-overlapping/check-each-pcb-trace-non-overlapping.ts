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
import {
  segmentToBoundsMinDistance,
  segmentToCircleMinDistance,
} from "@tscircuit/math-utils"
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
import { getClosestPointBetweenSegments } from "./getClosestPointBetweenSegments"
import { getCenterOfBounds } from "./getCenterOfBounds"
import { getRadiusOfCircuitJsonElement } from "./getRadiusOfCircuitJsonElement"
import { getClosestPointBetweenSegmentAndBounds } from "./getClosestPointBetweenSegmentAndBounds"
import { getLayersOfPcbElement } from "../util/getLayersOfPcbElement"

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
      if (p1.route_type !== "wire") continue
      if (p2.route_type !== "wire") continue
      if (p1.layer !== p2.layer) continue
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
        layer: p1.layer,
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

    for (const obj of nearbyObjects) {
      // ignore obstacles not on the trace's layer (except vias)
      if (!getLayersOfPcbElement(obj).includes(segmentA.layer)) {
        continue
      }
      if (obj.type === "pcb_trace_segment") {
        const segmentB = obj

        if (segmentA.layer !== segmentB.layer) continue

        // Check if the segments are overlapping
        if (
          connMap.areIdsConnected(segmentA.pcb_trace_id, segmentB.pcb_trace_id)
        )
          continue

        const gap =
          segmentToSegmentMinDistance(
            { x: segmentA.x1, y: segmentA.y1 },
            { x: segmentA.x2, y: segmentA.y2 },
            { x: segmentB.x1, y: segmentB.y1 },
            { x: segmentB.x2, y: segmentB.y2 },
          ) -
          segmentA.thickness / 2 -
          segmentB.thickness / 2
        if (gap > DEFAULT_TRACE_MARGIN - EPSILON) continue

        const pcb_trace_error_id = `overlap_${segmentA.pcb_trace_id}_${segmentB.pcb_trace_id}`
        const pcb_trace_error_id_reverse = `overlap_${segmentB.pcb_trace_id}_${segmentA.pcb_trace_id}`
        if (errorIds.has(pcb_trace_error_id)) continue
        if (errorIds.has(pcb_trace_error_id_reverse)) continue

        errorIds.add(pcb_trace_error_id)
        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          message: `PCB trace ${getReadableName(segmentA.pcb_trace_id)} overlaps with ${getReadableName(segmentB.pcb_trace_id)} ${gap < 0 ? "(accidental contact)" : `(gap: ${gap.toFixed(3)}mm)`}`,
          pcb_trace_id: segmentA.pcb_trace_id,
          source_trace_id: "",
          pcb_trace_error_id,
          pcb_component_ids: [],
          center: getClosestPointBetweenSegments(segmentA, segmentB),
          pcb_port_ids: getPcbPortIdsConnectedToTraces([
            segmentA._pcbTrace,
            segmentB._pcbTrace,
          ]),
        })
        continue
      }

      const primaryObjId = getPrimaryId(obj as any)
      if (
        connMap.areIdsConnected(
          segmentA.pcb_trace_id,
          "pcb_trace_id" in obj ? (obj.pcb_trace_id as string) : primaryObjId,
        )
      )
        continue

      // Check connectivity via pcb_port_id (for smtpads and plated holes)
      // (e.g., when source_trace_id is a combined net name that doesn't exist)
      if ("pcb_port_id" in obj && obj.pcb_port_id) {
        // First try using route segment port IDs (works when they're populated)
        const tracePortIds = getPcbPortIdsConnectedToTraces([
          segmentA._pcbTrace,
        ])
        if (tracePortIds.includes(obj.pcb_port_id as string)) {
          continue
        }

        // Fallback: check if any trace endpoint is at the same location as the object
        // This handles the case where port IDs aren't populated at DRC time
        const route = segmentA._pcbTrace?.route
        if (route && route.length > 0 && "x" in obj && "y" in obj) {
          const firstPoint = route[0]
          const lastPoint = route[route.length - 1]
          const objX = (obj as any).x as number
          const objY = (obj as any).y as number
          const tolerance = 0.01 // 10 micron tolerance for coordinate matching

          const isAtFirstPoint =
            Math.abs(firstPoint.x - objX) < tolerance &&
            Math.abs(firstPoint.y - objY) < tolerance
          const isAtLastPoint =
            Math.abs(lastPoint.x - objX) < tolerance &&
            Math.abs(lastPoint.y - objY) < tolerance

          if (isAtFirstPoint || isAtLastPoint) {
            continue
          }
        }
      }

      const isCircular =
        obj.type === "pcb_via" ||
        (obj.type === "pcb_plated_hole" && obj.shape === "circle") ||
        obj.type === "pcb_hole" ||
        (obj.type === "pcb_smtpad" && obj.shape === "circle")

      if (isCircular) {
        const radius = getRadiusOfCircuitJsonElement(obj)
        const distance = segmentToCircleMinDistance(
          { x: segmentA.x1, y: segmentA.y1 },
          { x: segmentA.x2, y: segmentA.y2 },
          { x: obj.x, y: obj.y, radius },
        )
        const gap = distance - segmentA.thickness / 2
        if (gap > DEFAULT_TRACE_MARGIN - EPSILON) continue

        const pcb_trace_error_id = `overlap_${segmentA.pcb_trace_id}_${primaryObjId}`
        if (errorIds.has(pcb_trace_error_id)) continue
        errorIds.add(pcb_trace_error_id)
        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          message: `PCB trace ${getReadableName(segmentA.pcb_trace_id)} overlaps with ${obj.type} "${getReadableName(getPrimaryId(obj as any))}" ${gap < 0 ? "(accidental contact)" : `(gap: ${gap.toFixed(3)}mm)`}`,
          pcb_trace_id: segmentA.pcb_trace_id,
          center: getClosestPointBetweenSegmentAndBounds(
            segmentA,
            getCollidableBounds(obj),
          ),
          source_trace_id: "",
          pcb_trace_error_id,
          pcb_component_ids: [
            "pcb_component_id" in obj
              ? (obj.pcb_component_id as string)
              : undefined,
          ].filter(Boolean) as string[],
          pcb_port_ids: [
            ...getPcbPortIdsConnectedToTraces([segmentA._pcbTrace]),
            "pcb_port_id" in obj ? obj.pcb_port_id : undefined,
          ].filter(Boolean) as string[],
        })
      }

      // Handle generic case of hitting the bounds of any collidable obstacle
      // using the bounds of the collidable obstacle
      const gap =
        segmentToBoundsMinDistance(
          { x: segmentA.x1, y: segmentA.y1 },
          { x: segmentA.x2, y: segmentA.y2 },
          getCollidableBounds(obj),
        ) -
        segmentA.thickness / 2
      if (gap + EPSILON < requiredMargin) {
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
          center: getClosestPointBetweenSegmentAndBounds(
            segmentA,
            getCollidableBounds(obj),
          ),
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
