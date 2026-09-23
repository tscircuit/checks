import { segmentToSegmentMinDistance } from "@tscircuit/math-utils"
import type { AnyCircuitElement, PcbTraceError } from "circuit-json"
import { getClosestPointBetweenSegments } from "./check-each-pcb-trace-non-overlapping/getClosestPointBetweenSegments"
import type { PcbTraceSegment } from "./check-each-pcb-trace-non-overlapping/getCollidableBounds"
import { getPcbPortIdsConnectedToTraces } from "./check-each-pcb-trace-non-overlapping/getPcbPortIdsConnectedToTraces"

type Segment = PcbTraceSegment & {
  startDistance: number
  endDistance: number
  run: number
}

/** Detect copper contact that bypasses part of a length-matched route. */
export function checkPcbTraceSelfShorts(
  circuitJson: AnyCircuitElement[],
): PcbTraceError[] {
  const matchedSourceTraceIds = new Set(
    circuitJson.flatMap((element) =>
      element.type === "source_bus" && element.max_length_skew !== undefined
        ? element.source_trace_ids
        : [],
    ),
  )
  const errors: PcbTraceError[] = []
  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace") continue
    if (
      !trace.source_trace_id ||
      !matchedSourceTraceIds.has(trace.source_trace_id)
    )
      continue

    const segments: Segment[] = []
    let distance = 0
    let run = 0
    for (let i = 0; i < trace.route.length - 1; i++) {
      const a = trace.route[i]!
      const b = trace.route[i + 1]!
      if (
        a.route_type !== "wire" ||
        b.route_type !== "wire" ||
        a.layer !== b.layer
      ) {
        run++
        continue
      }
      const length = Math.hypot(b.x - a.x, b.y - a.y)
      if (length === 0) continue
      segments.push({
        type: "pcb_trace_segment",
        _pcbTrace: trace,
        pcb_trace_id: trace.pcb_trace_id,
        thickness: a.width,
        layer: a.layer,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        run,
        startDistance: distance,
        endDistance: distance + length,
      })
      distance += length
    }

    pairs: for (let i = 0; i < segments.length; i++) {
      const a = segments[i]!
      for (let j = i + 1; j < segments.length; j++) {
        const b = segments[j]!
        if (a.layer !== b.layer) continue
        const contactDistance = (a.thickness + b.thickness) / 2
        // Neighboring copper naturally overlaps at bends, including bends
        // subdivided into several short segments. Only test nonlocal contact.
        const dot =
          (a.x2 - a.x1) * (b.x2 - b.x1) + (a.y2 - a.y1) * (b.y2 - b.y1)
        const cross =
          (a.x2 - a.x1) * (b.y2 - b.y1) - (a.y2 - a.y1) * (b.x2 - b.x1)
        const adjacent = a.run === b.run && b.startDistance === a.endDistance
        // An immediately retraced segment is a short too; ordinary adjacent
        // bends share copper intentionally.
        if (adjacent && !(dot < 0 && Math.abs(cross) < 1e-9)) continue
        if (
          !adjacent &&
          a.run === b.run &&
          b.startDistance - a.endDistance < contactDistance &&
          dot >= 0
        )
          continue
        const gap =
          segmentToSegmentMinDistance(
            { x: a.x1, y: a.y1 },
            { x: a.x2, y: a.y2 },
            { x: b.x1, y: b.y1 },
            { x: b.x2, y: b.y2 },
          ) - contactDistance
        if (gap > 1e-9) continue
        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          pcb_trace_error_id: `self_short_${trace.pcb_trace_id}`,
          pcb_trace_id: trace.pcb_trace_id,
          source_trace_id: trace.source_trace_id,
          message: `PCB trace ${trace.pcb_trace_id} shorts to itself, bypassing part of its length-matched route`,
          center: getClosestPointBetweenSegments(a, b),
          pcb_component_ids: [],
          pcb_port_ids: getPcbPortIdsConnectedToTraces([trace]),
          subcircuit_id: trace.subcircuit_id,
        })
        break pairs
      }
    }
  }
  return errors
}
