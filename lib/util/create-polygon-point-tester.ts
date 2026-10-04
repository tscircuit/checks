import * as Flatten from "@flatten-js/core"

interface PolygonFaces {
  linear: Set<Flatten.Face>
  curved: Flatten.Polygon[]
}

/** Cache only for one check: the converted polygons must remain unchanged. */
export function createPolygonPointTester(): (
  polygon: Flatten.Polygon,
  point: Flatten.Point,
) => boolean {
  const cache = new WeakMap<Flatten.Polygon, PolygonFaces>()
  return (polygon, point): boolean => {
    let faces = cache.get(polygon)
    if (!faces) {
      faces = { linear: new Set(), curved: [] }
      for (const face of polygon.faces) {
        const shapes = face.shapes
        if (
          shapes.every(
            (shape: Flatten.Segment | Flatten.Arc): boolean =>
              shape instanceof Flatten.Segment,
          )
        ) {
          faces.linear.add(face)
        } else {
          // Keep analytic arcs and their existing containment semantics. Only
          // straight-edged rings need the half-open segment crossing rule.
          const curved = new Flatten.Polygon()
          curved.addFace(shapes)
          faces.curved.push(curved)
        }
      }
      cache.set(polygon, faces)
    }

    // Retain Flatten's boundary tolerance, but do not use fuzzy endpoint
    // equality to count crossings: a tiny edge can match both endpoints.
    const tolerance = Flatten.Utils.getTolerance()
    const candidates = polygon.edges.search(
      new Flatten.Box(
        point.x - tolerance,
        point.y - tolerance,
        Infinity,
        point.y + tolerance,
      ),
    ) as unknown as Flatten.PolygonEdge[]
    for (const edge of candidates) {
      if (edge.shape.contains(point)) return true
    }

    let inside = false
    for (const edge of candidates) {
      if (!faces.linear.has(edge.face)) continue
      const { start, end } = edge.shape
      // Half-open y intervals count a shared vertex once and ignore horizontal
      // edges. Subdividing an edge cannot introduce extra ray crossings.
      if (start.y > point.y === end.y > point.y) continue
      const x =
        start.x + ((point.y - start.y) * (end.x - start.x)) / (end.y - start.y)
      if (x > point.x) inside = !inside
    }
    // Even/odd fill includes holes and separate faces regardless of winding.
    for (const curved of faces.curved) {
      if (curved.contains(point)) inside = !inside
    }
    return inside
  }
}
