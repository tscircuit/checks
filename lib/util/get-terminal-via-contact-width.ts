import type { PcbTrace } from "circuit-json"

/** A terminal wire point can mark a via landing without a lateral segment.
 * Only use this width for via contact, never to invent terminal wire copper.
 */
export function getTerminalViaContactWidth(
  trace: PcbTrace,
  endpoint: "start" | "end",
): number | undefined {
  if (trace.route_thickness_mode === "interpolated") return undefined
  const step = endpoint === "start" ? 1 : -1
  const index = endpoint === "start" ? 0 : trace.route.length - 1
  const point = trace.route[index]
  if (
    point?.route_type !== "wire" ||
    !Number.isFinite(point.width) ||
    point.width <= 0
  )
    return undefined
  for (let i = index + step; i >= 0 && i < trace.route.length; i += step) {
    const next = trace.route[i]!
    if (next.route_type !== "wire" && next.route_type !== "via")
      return undefined
    if (Math.hypot(next.x - point.x, next.y - point.y) > 1e-9) return undefined
    if (next.route_type === "via") {
      return next.from_layer === point.layer || next.to_layer === point.layer
        ? point.width
        : undefined
    }
    if (next.route_type !== "wire" || next.layer !== point.layer)
      return undefined
  }
  return undefined
}
