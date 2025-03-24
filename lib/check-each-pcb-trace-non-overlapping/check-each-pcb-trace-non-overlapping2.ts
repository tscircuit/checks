import type { AnyCircuitElement, PcbTraceError } from "circuit-json"
import { su } from "@tscircuit/soup-util"
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
import { DEFAULT_TRACE_MARGIN, DEFAULT_TRACE_THICKNESS } from "lib/drc-defaults"
import { getPcbPortIdsConnectedToTraces } from "./getPcbPortIdsConnectedToTraces"
import { segmentToSegmentMinDistance } from "@tscircuit/math-utils"
import { areBoundsOverlapping } from "./are-bounds-overlapping"

export function checkEachPcbTraceNonOverlapping(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
  }: {
    connMap?: ConnectivityMap
  },
): PcbTraceError[] {
  const errors: PcbTraceError[] = []
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)

  const pcbTraces = su(circuitJson).pcb_trace.list()
  const pcbTraceSegments = pcbTraces.flatMap((pcbTrace) => {
    const segments = []
    for (let i = 0; i < pcbTrace.route.length - 1; i++) {
      const p1 = pcbTrace.route[i]
      const p2 = pcbTrace.route[i + 1]
      segments.push({
        type: "pcb_trace_segment",
        pcb_trace_id: pcbTrace.pcb_trace_id,
        _pcbTrace: pcbTrace,
        thickness: DEFAULT_TRACE_THICKNESS,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
      } as PcbTraceSegment)
    }
    return segments
  })
  const pcbSmtPads = su(circuitJson).pcb_smtpad.list()
  const pcbPlatedHoles = su(circuitJson).pcb_plated_hole.list()
  const pcbHoles = su(circuitJson).pcb_hole.list()
  const pcbVias = su(circuitJson).pcb_via.list()
  const pcbKeepouts = su(circuitJson).pcb_keepout.list()

  const spatialIndex = new SpatialObjectIndex<Collidable>({
    objects: [
      ...pcbTraceSegments,
      ...pcbSmtPads,
      ...pcbPlatedHoles,
      ...pcbHoles,
      ...pcbVias,
      ...pcbKeepouts,
    ],
    getBounds: getCollidableBounds,
  })

  // For each segment, check it if overlaps with anything collidable
  for (const segmentA of pcbTraceSegments) {
    const overlappingObjects = spatialIndex.getObjectsInBounds(
      getCollidableBounds(segmentA),
    )
    for (const obj of overlappingObjects) {
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
          ) > DEFAULT_TRACE_MARGIN
        )
          continue

        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          message: `PCB trace ${segmentA.pcb_trace_id} overlaps with ${segmentB.pcb_trace_id}`,
          pcb_trace_id: segmentA.pcb_trace_id,
          source_trace_id: "",
          pcb_trace_error_id: `overlap_${segmentA.pcb_trace_id}_${segmentB.pcb_trace_id}`,
          pcb_component_ids: [],
          // @ts-ignore this is available in a future version of @tscircuit/soup
          center: overlapPoint,
          pcb_port_ids: getPcbPortIdsConnectedToTraces([
            segmentA._pcbTrace,
            segmentB._pcbTrace,
          ]),
        })
        continue
      }
      // Check if the
      if (
        areBoundsOverlapping(
          getCollidableBounds(segmentA),
          getCollidableBounds(obj),
        )
      ) {
        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          message: `PCB trace ${segmentA.pcb_trace_id} overlaps with ${obj.type} "${getPrimaryId()}"`,
        })
      }
    }
  }
  return errors
}
