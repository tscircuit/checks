import * as Flatten from "@flatten-js/core"

/** Even/odd containment without fuzzy endpoint counting on straight edges. */
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
  ) as unknown as Flatten.PolygonEdge[]
  // Preserve the existing boundary tolerance and analytic arc handling.
  if (edges.some((edge) => edge.shape.contains(point))) return true
  const curvedFaces = new Set(
    edges
      .filter((edge) => edge.shape instanceof Flatten.Arc)
      .map((edge) => edge.face),
  )
  let inside = false
  for (const edge of edges) {
    if (curvedFaces.has(edge.face)) continue
    const { start, end } = edge.shape
    // Half-open y intervals count shared vertices once, including tiny edges.
    if (start.y > point.y === end.y > point.y) continue
    const x =
      start.x + ((point.y - start.y) * (end.x - start.x)) / (end.y - start.y)
    if (x > point.x) inside = !inside
  }
  for (const face of curvedFaces) {
    const ring = new Flatten.Polygon()
    ring.addFace(face.shapes)
    if (ring.contains(point)) inside = !inside
  }
  return inside
}
