import type {
  AnyCircuitElement,
  PcbTrace,
  PcbTraceUncoupledLengthError,
  SourceTrace,
} from "circuit-json"

const EPSILON = 1e-9

type Segment = {
  x: number
  y: number
  dx: number
  dy: number
  length: number
  layer?: string
}

/** Planar travel only: via barrels have no length in this geometric check.
 * Through-pad travel and malformed layer transitions cannot establish coupling.
 */
const getSegments = (traces: PcbTrace[]): Segment[] => {
  const segments: Segment[] = []
  const add = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    layer?: string,
  ) => {
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    if (length === 0) return
    segments.push({
      ...start,
      dx: (end.x - start.x) / length,
      dy: (end.y - start.y) / length,
      length,
      layer,
    })
  }
  for (const trace of traces) {
    for (let i = 0; i < trace.route.length; i++) {
      const point = trace.route[i]!
      if (point.route_type === "through_pad") add(point.start, point.end)
      const next = trace.route[i + 1]
      if (!next) continue
      const end = next.route_type === "through_pad" ? next.start : next
      const start = point.route_type === "through_pad" ? point.end : point
      const fromLayer =
        point.route_type === "wire"
          ? point.layer
          : point.route_type === "via"
            ? point.to_layer
            : point.end_layer
      const toLayer =
        next.route_type === "wire"
          ? next.layer
          : next.route_type === "via"
            ? next.from_layer
            : next.start_layer
      add(start, end, fromLayer === toLayer ? fromLayer : undefined)
    }
  }
  return segments
}

const getUncoupledLength = (
  segment: Segment,
  partners: Segment[],
  maxDistance: number,
): number => {
  if (segment.layer === undefined) return segment.length
  const intervals: [number, number][] = []
  for (const partner of partners) {
    if (partner.layer !== segment.layer) continue
    // Both route directions are valid; crossings and fanout are not coupling.
    if (Math.abs(segment.dx * partner.dy - segment.dy * partner.dx) > EPSILON)
      continue
    const x = partner.x - segment.x
    const y = partner.y - segment.y
    if (Math.abs(x * segment.dy - y * segment.dx) > maxDistance + EPSILON)
      continue
    const start = x * segment.dx + y * segment.dy
    const end =
      start +
      partner.length * (segment.dx * partner.dx + segment.dy * partner.dy)
    const low = Math.max(0, Math.min(start, end))
    const high = Math.min(segment.length, Math.max(start, end))
    if (high > low) intervals.push([low, high])
  }
  intervals.sort((a, b) => a[0] - b[0])
  let covered = 0
  let coveredEnd = 0
  for (const [start, end] of intervals) {
    covered += Math.max(0, end - Math.max(start, coveredEnd))
    coveredEnd = Math.max(coveredEnd, end)
  }
  return Math.max(0, segment.length - covered)
}

/** Check each configured source trace independently. Coupling means parallel,
 * overlapping centerlines on the same layer, within max_coupling_distance.
 * The maximum applies to total uncoupled planar length across all fragments,
 * not just the longest continuous uncoupled section. Cached trace_length is
 * intentionally ignored because it cannot describe where coupling occurs.
 */
export const checkPcbTraceUncoupledLength = (
  circuitJson: AnyCircuitElement[],
): PcbTraceUncoupledLengthError[] => {
  const sources = new Map(
    circuitJson
      .filter((e): e is SourceTrace => e.type === "source_trace")
      .map((e) => [e.source_trace_id, e]),
  )
  const tracesBySource = new Map<string, PcbTrace[]>()
  for (const element of circuitJson) {
    if (element.type !== "pcb_trace" || !element.source_trace_id) continue
    const traces = tracesBySource.get(element.source_trace_id) ?? []
    traces.push(element)
    tracesBySource.set(element.source_trace_id, traces)
  }
  const segmentsBySource = new Map(
    [...tracesBySource].map(([id, traces]) => [id, getSegments(traces)]),
  )
  const errors: PcbTraceUncoupledLengthError[] = []
  for (const source of sources.values()) {
    const maximum = source.max_uncoupled_length
    const distance = source.max_coupling_distance
    const partnerId = source.coupled_source_trace_id
    if (
      maximum === undefined ||
      distance === undefined ||
      !Number.isFinite(maximum) ||
      !Number.isFinite(distance) ||
      maximum < 0 ||
      distance < 0 ||
      !partnerId ||
      partnerId === source.source_trace_id ||
      !sources.has(partnerId)
    )
      continue
    const segments = segmentsBySource.get(source.source_trace_id)
    const partners = segmentsBySource.get(partnerId)
    // Unrouted members are handled by connectivity checks, not a length DRC.
    if (!segments?.length || !partners?.length) continue
    const actual = segments.reduce(
      (sum, segment) => sum + getUncoupledLength(segment, partners, distance),
      0,
    )
    if (actual <= maximum + EPSILON) continue
    errors.push({
      type: "pcb_trace_uncoupled_length_error",
      pcb_trace_uncoupled_length_error_id: `pcb_trace_uncoupled_length_error_${source.source_trace_id}`,
      error_type: "pcb_trace_uncoupled_length_error",
      message: `PCB trace ${source.name ?? source.source_trace_id} has ${actual.toFixed(2)}mm uncoupled length, exceeding the ${maximum}mm maximum`,
      source_trace_id: source.source_trace_id,
      coupled_source_trace_id: partnerId,
      pcb_trace_ids: tracesBySource
        .get(source.source_trace_id)!
        .map((t) => t.pcb_trace_id),
      actual_uncoupled_length: actual,
      maximum_uncoupled_length: maximum,
      subcircuit_id: source.subcircuit_id,
    })
  }
  return errors
}
