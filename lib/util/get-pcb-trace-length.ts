import type { PcbTrace } from "circuit-json"

/** Use the router's length when supplied; otherwise measure the route in mm.
 * Via depth defaults to 1.6mm, matching the existing trace length check.
 */
export const getPcbTraceLength = (trace: PcbTrace): number => {
  if (trace.trace_length !== undefined) return trace.trace_length
  let length = 0
  let previousEnd: { x: number; y: number } | undefined
  for (const point of trace.route) {
    const start = point.route_type === "through_pad" ? point.start : point
    if (previousEnd)
      length += Math.hypot(start.x - previousEnd.x, start.y - previousEnd.y)
    if (point.route_type === "via") length += 1.6
    if (point.route_type === "through_pad") {
      length += Math.hypot(
        point.end.x - point.start.x,
        point.end.y - point.start.y,
      )
      previousEnd = point.end
    } else {
      previousEnd = point
    }
  }
  return length
}
