import type { RouteSegment } from "./measure-route"
type Interval = [number, number]
type Point = { x: number; y: number }
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y
const subtract = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y })
/** Exact parametric intervals where a line lies inside another line's capsule.
 * Splitting at projection endpoints handles crossings and diagonal segments,
 * without sampling that can miss brief clearance violations. */
export function capsuleIntervals(
  a: RouteSegment,
  b: RouteSegment,
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
export const unionLength = (intervals: Interval[]) => {
  intervals.sort((a, b) => a[0] - b[0])
  let total = 0,
    last = -1
  for (const [from, to] of intervals) {
    total += Math.max(0, to - Math.max(from, last))
    last = Math.max(last, to)
  }
  return total
}

/** Minimum Euclidean centerline separation in board-world XY mm. */
export function segmentSeparation(a: RouteSegment, b: RouteSegment): number {
  const cross = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const overlap = (p: number, q: number, r: number, s: number) =>
    Math.max(Math.min(p, q), Math.min(r, s)) <=
    Math.min(Math.max(p, q), Math.max(r, s))
  if (
    overlap(a.a.x, a.b.x, b.a.x, b.b.x) &&
    overlap(a.a.y, a.b.y, b.a.y, b.b.y) &&
    cross(a.a, a.b, b.a) * cross(a.a, a.b, b.b) <= 0 &&
    cross(b.a, b.b, a.a) * cross(b.a, b.b, a.b) <= 0
  )
    return 0
  const pointDistance = (p: Point, segment: RouteSegment) => {
    const dx = segment.b.x - segment.a.x,
      dy = segment.b.y - segment.a.y
    const lengthSquared = dx * dx + dy * dy
    const t = lengthSquared
      ? Math.max(
          0,
          Math.min(
            1,
            ((p.x - segment.a.x) * dx + (p.y - segment.a.y) * dy) /
              lengthSquared,
          ),
        )
      : 0
    return Math.hypot(p.x - segment.a.x - t * dx, p.y - segment.a.y - t * dy)
  }
  return Math.min(
    pointDistance(a.a, b),
    pointDistance(a.b, b),
    pointDistance(b.a, a),
    pointDistance(b.b, a),
  )
}
