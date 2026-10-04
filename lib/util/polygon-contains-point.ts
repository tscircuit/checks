import * as Flatten from "@flatten-js/core"

/** Even/odd containment without fuzzy endpoint counting at shared vertices. */
export function polygonContainsPoint(
  polygon: Flatten.Polygon,
  point: Flatten.Point,
): boolean {
  const tolerance = Flatten.Utils.getTolerance()
  const edges = polygon.edges.search(
    new Flatten.Box(
      point.x - tolerance,
      point.y - tolerance,
      Infinity,
      point.y + tolerance,
    ),
  )
  let inside = false
  for (const edge of edges) {
    // Flatten's search declaration says shapes, but polygon indexes hold edges.
    if (!(edge instanceof Flatten.Edge)) {
      throw new Error("Expected a polygon edge in the spatial index")
    }
    const shape: unknown = edge.shape
    if (!(shape instanceof Flatten.Segment || shape instanceof Flatten.Arc)) {
      throw new Error("Expected a segment or arc in the polygon")
    }
    // Keep Flatten's boundary tolerance; crossing ownership below is exact.
    if (shape.contains(point)) return true
    if (shape instanceof Flatten.Segment) {
      const { start, end } = shape
      // Half-open y intervals count shared vertices once, including tiny edges.
      if (start.y > point.y === end.y > point.y) continue
      const x =
        start.x + ((point.y - start.y) * (end.x - start.x)) / (end.y - start.y)
      if (x > point.x) inside = !inside
    } else {
      // Monotone analytic arcs use the same half-open rule as straight edges.
      // Only this arc is split; no face is cloned or spatial index rebuilt.
      // Normalize the start: Flatten does not split clockwise arcs from 2π.
      const turn = 2 * Math.PI
      const startAngle = ((shape.startAngle % turn) + turn) % turn
      const arcs = new Flatten.Arc(
        shape.pc,
        shape.r,
        startAngle,
        startAngle + (shape.counterClockwise ? shape.sweep : -shape.sweep),
        shape.counterClockwise,
      ).breakToFunctional()
      // Use the adjoining segment's existing vertex at an arc/segment join;
      // recomputing it with sin/cos can split one vertex by roundoff.
      const startY =
        edge.prev.shape instanceof Flatten.Segment
          ? edge.prev.end.y
          : shape.start.y
      const endY = edge.next.start.y
      for (const [index, arc] of arcs.entries()) {
        const fromY = index === 0 ? startY : arc.start.y
        const toY = index === arcs.length - 1 ? endY : arc.end.y
        if (fromY > point.y === toY > point.y) continue
        const dy = point.y - arc.pc.y
        if (Math.abs(dy) > arc.r) continue
        const dx = Math.sqrt((arc.r - dy) * (arc.r + dy))
        const x = arc.pc.x + (arc.middle().x >= arc.pc.x ? dx : -dx)
        if (x > point.x) inside = !inside
      }
    }
  }
  return inside
}
