import { cju } from "@tscircuit/circuit-json-util"
import { segmentToSegmentMinDistance } from "@tscircuit/math-utils"
import {
  all_layers,
  type AnyCircuitElement,
  type PcbTraceError,
} from "circuit-json"
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
  const db = cju(circuitJson)
  const errors: PcbTraceError[] = []
  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace") continue
    if (
      !trace.source_trace_id ||
      !matchedSourceTraceIds.has(trace.source_trace_id)
    )
      continue

    const segments: Segment[] = []
    const routeDistances: number[] = []
    let distance = 0
    let run = 0
    for (let i = 0; i < trace.route.length - 1; i++) {
      routeDistances[i] = distance
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

    routeDistances[trace.route.length - 1] = distance
    let shortCenter: { x: number; y: number } | undefined

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
        const directionLengthProduct =
          Math.hypot(a.x2 - a.x1, a.y2 - a.y1) *
          Math.hypot(b.x2 - b.x1, b.y2 - b.y1)
        // Compare normalized directions: roundoff can make a right-angle dot
        // product slightly negative, especially at tiny chamfer segments.
        const isForwardOrRightAngle = dot >= -1e-9 * directionLengthProduct
        const adjacent = a.run === b.run && b.startDistance === a.endDistance
        // An immediately retraced segment is a short too; ordinary adjacent
        // bends share copper intentionally.
        if (adjacent && !(dot < 0 && Math.abs(cross) < 1e-9)) continue
        if (
          !adjacent &&
          a.run === b.run &&
          // A right-angle connector can have sqrt(2) times the straight-line
          // distance. Its local copper overlap is still part of the same bend.
          b.startDistance - a.endDistance <= Math.SQRT2 * contactDistance &&
          isForwardOrRightAngle
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
        shortCenter = getClosestPointBetweenSegments(a, b)
        break pairs
      }
    }
    // Via copper can contact a distant section even when wire centerlines do
    // not cross. Use route position to distinguish the intentional entry/exit
    // from contact that bypasses a detour.
    if (!shortCenter) {
      const board = circuitJson.find((e) => e.type === "pcb_board")
      const stack = [
        "top",
        ...all_layers
          .filter((layer) => layer.startsWith("inner"))
          .slice(0, board ? Math.max(0, board.num_layers - 2) : undefined),
        ...(board?.num_layers === 1 ? [] : ["bottom"]),
      ]
      vias: for (let i = 0; i < trace.route.length; i++) {
        const point = trace.route[i]!
        if (point.route_type !== "via") continue
        const materialized = db.pcb_via
          .list()
          .find(
            (via) =>
              (via.pcb_trace_id === trace.pcb_trace_id ||
                (!via.pcb_trace_id &&
                  via.source_trace_id === trace.source_trace_id)) &&
              Math.hypot(via.x - point.x, via.y - point.y) <= 1e-9,
          )
        const diameter = materialized?.outer_diameter ?? point.outer_diameter
        if (
          diameter === undefined ||
          !Number.isFinite(diameter) ||
          diameter <= 0
        )
          continue
        const from = stack.indexOf(point.from_layer)
        const to = stack.indexOf(point.to_layer)
        const layers =
          materialized?.layers ??
          (from >= 0 && to >= 0
            ? stack.slice(Math.min(from, to), Math.max(from, to) + 1)
            : [])
        for (const segment of segments) {
          if (!layers.includes(segment.layer)) continue
          const reach = (diameter + segment.thickness) / 2
          const alongRouteGap = Math.max(
            segment.startDistance - routeDistances[i]!,
            routeDistances[i]! - segment.endDistance,
            0,
          )
          // Includes subdivided entry/exit segments inside the via land.
          if (alongRouteGap <= reach + 1e-9) continue
          const viaSegment = {
            ...segment,
            x1: point.x,
            y1: point.y,
            x2: point.x,
            y2: point.y,
          }
          const gap =
            segmentToSegmentMinDistance(
              point,
              point,
              { x: segment.x1, y: segment.y1 },
              { x: segment.x2, y: segment.y2 },
            ) - reach
          if (gap > 1e-9) continue
          shortCenter = getClosestPointBetweenSegments(segment, viaSegment)
          break vias
        }
      }
    }
    if (shortCenter) {
      const sourceTrace = db.source_trace.get(trace.source_trace_id)
      const endpointNames = (sourceTrace?.connected_source_port_ids ?? [])
        .map((id) => {
          const port = db.source_port.get(id)
          const component = port?.source_component_id
            ? db.source_component.get(port.source_component_id)
            : undefined
          return component?.name && port?.name
            ? `${component.name}.${port.name}`
            : undefined
        })
        .filter((name): name is string => Boolean(name))
      const traceName =
        sourceTrace?.name ||
        sourceTrace?.display_name ||
        endpointNames.join(" → ") ||
        "unnamed"
      errors.push({
        type: "pcb_trace_error",
        error_type: "pcb_trace_error",
        pcb_trace_error_id: `self_short_${trace.pcb_trace_id}`,
        pcb_trace_id: trace.pcb_trace_id,
        source_trace_id: trace.source_trace_id,
        message: `PCB trace "${traceName}" shorts to itself, bypassing part of its length-matched route`,
        center: shortCenter,
        pcb_component_ids: [],
        pcb_port_ids: getPcbPortIdsConnectedToTraces([trace]),
        subcircuit_id: trace.subcircuit_id,
      })
    }
  }
  return errors
}
