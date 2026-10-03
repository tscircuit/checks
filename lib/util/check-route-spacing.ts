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
