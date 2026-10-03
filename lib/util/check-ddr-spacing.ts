import Flatbush from "flatbush"
import type { SourceBus, SourceTrace } from "circuit-json"
import type { DdrRouteMeasurement, DdrSegment } from "./measure-ddr-route"

type Interval = [number, number]
type Point = { x: number; y: number }
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y
const subtract = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y })
/** Exact parametric intervals where a line lies inside another line's capsule.
 * Splitting at projection endpoints handles crossings and diagonal segments,
 * without sampling that can miss brief clearance violations. */
export function capsuleIntervals(
  a: DdrSegment,
  b: DdrSegment,
  radius: number,
): Interval[] {
  const v = subtract(a.b, a.a),
    u = subtract(b.b, b.a),
    d = subtract(a.a, b.a)
  const uu = dot(u, u)
  if (uu === 0) return []
  const start = dot(d, u) / uu,
    slope = dot(v, u) / uu
  const cuts = [0, 1]
  if (Math.abs(slope) > 1e-15)
    for (const t of [-start / slope, (1 - start) / slope])
      if (t > 0 && t < 1) cuts.push(t)
  cuts.sort((x, y) => x - y)
  const intervals: Interval[] = []
  for (let i = 0; i < cuts.length - 1; i++) {
    const lo = cuts[i]!,
      hi = cuts[i + 1]!,
      projection = start + (slope * (lo + hi)) / 2
    let base = d,
      velocity = v
    if (projection >= 1) base = subtract(a.a, b.b)
    else if (projection > 0) {
      base = { x: d.x - u.x * start, y: d.y - u.y * start }
      velocity = { x: v.x - u.x * slope, y: v.y - u.y * slope }
    }
    const A = dot(velocity, velocity),
      B = 2 * dot(base, velocity),
      C = dot(base, base) - radius * radius
    if (A < 1e-20) {
      if (C < -1e-12) intervals.push([lo, hi])
      continue
    }
    const discriminant = B * B - 4 * A * C
    if (discriminant <= 0) continue
    const root = Math.sqrt(discriminant)
    const from = Math.max(lo, (-B - root) / (2 * A)),
      to = Math.min(hi, (-B + root) / (2 * A))
    if (to - from > 1e-10) intervals.push([from, to])
  }
  return intervals
}
const unionLength = (intervals: Interval[]) => {
  intervals.sort((a, b) => a[0] - b[0])
  let total = 0,
    last = -1
  for (const [from, to] of intervals) {
    total += Math.max(0, to - Math.max(from, last))
    last = Math.max(last, to)
  }
  return total
}
export interface DdrSpacingFinding {
  sourceTraceId: SourceTrace["source_trace_id"]
  belowMinimum: boolean
  reducedLength: number
}
/** TI centreline spacing: same-byte DQ and same ADDR group 3w; otherwise 4w.
 * Pair-internal spacing is controlled by impedance, not these inter-net rules.
 * Reduced spacing to w is allowed for at most 1250 mil per signal. Unioning
 * intervals prevents two neighbours charging the same length twice. */
export function checkDdrSpacing(
  measures: Map<SourceTrace["source_trace_id"], DdrRouteMeasurement>,
  owners: Map<SourceTrace["source_trace_id"], SourceBus>,
): DdrSpacingFinding[] {
  const layers = new Map<
    string,
    Array<{ id: SourceTrace["source_trace_id"]; segment: DdrSegment }>
  >()
  for (const [id, route] of measures)
    for (const segment of route.segments) {
      const items = layers.get(segment.layer) ?? []
      items.push({ id, segment })
      layers.set(segment.layer, items)
    }
  const findings = new Map<SourceTrace["source_trace_id"], DdrSpacingFinding>()
  for (const items of layers.values()) {
    const maxWidth = Math.max(...items.map((e) => e.segment.width))
    const index = new Flatbush(items.length)
    for (const { segment: s } of items)
      index.add(
        Math.min(s.a.x, s.b.x),
        Math.min(s.a.y, s.b.y),
        Math.max(s.a.x, s.b.x),
        Math.max(s.a.y, s.b.y),
      )
    index.finish()
    for (const { id, segment: a } of items) {
      const intervals: Interval[] = []
      const margin = 4 * maxWidth
      const candidates = index.search(
        Math.min(a.a.x, a.b.x) - margin,
        Math.min(a.a.y, a.b.y) - margin,
        Math.max(a.a.x, a.b.x) + margin,
        Math.max(a.a.y, a.b.y) + margin,
      )
      const owner = owners.get(id)!
      let minimumViolation = false
      for (const k of candidates) {
        const other = items[k]!
        if (other.id === id) continue
        const otherOwner = owners.get(other.id)!
        const role = owner.ddr_routing!.signal_class
        if (owner === otherOwner && (role === "ck" || role === "dqs")) continue
        const sameClass =
          owner === otherOwner && (role === "dq" || role === "addr_ctrl")
        const width = Math.max(a.width, other.segment.width)
        intervals.push(
          ...capsuleIntervals(
            a,
            other.segment,
            (sameClass ? 3 : 4) * width - 1e-8,
          ),
        )
        minimumViolation ||=
          capsuleIntervals(a, other.segment, width - 1e-8).length > 0
      }
      const length =
        unionLength(intervals) * Math.hypot(a.b.x - a.a.x, a.b.y - a.a.y)
      const finding = findings.get(id) ?? {
        sourceTraceId: id,
        belowMinimum: false,
        reducedLength: 0,
      }
      finding.belowMinimum ||= minimumViolation
      finding.reducedLength += length
      findings.set(id, finding)
    }
  }
  return [...findings.values()].filter(
    (e) => e.belowMinimum || e.reducedLength > 31.75 + 1e-8,
  )
}
