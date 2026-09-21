import type { Arc, Box, Point, Polygon, Segment } from "@flatten-js/core"
import Flatbush from "flatbush"

interface PolygonGeometry {
  box: Box
  facePoints: Point[]
  edges: (Segment | Arc)[]
  edgeIndex?: Flatbush
}

/** Cache only for one connectivity pass: the input polygons must remain unchanged. */
export function createCopperPolygonContactTester(tolerance: number) {
  const cache = new WeakMap<Polygon, PolygonGeometry>()
  const getGeometry = (polygon: Polygon): PolygonGeometry => {
    let geometry = cache.get(polygon)
    if (!geometry) {
      geometry = {
        box: polygon.box,
        facePoints: [...polygon.faces].map((face) => face.first.start),
        edges: [...polygon.edges].map((edge) => edge.shape),
      }
      cache.set(polygon, geometry)
    }
    return geometry
  }
  const getEdgeIndex = (geometry: PolygonGeometry) => {
    if (!geometry.edgeIndex) {
      const index = new Flatbush(geometry.edges.length)
      for (const edge of geometry.edges) {
        const box = edge.box
        index.add(box.xmin, box.ymin, box.xmax, box.ymax)
      }
      index.finish()
      geometry.edgeIndex = index
    }
    return geometry.edgeIndex
  }
  return (a: Polygon, b: Polygon): boolean => {
    if (a.isEmpty() || b.isEmpty()) return false
    const ga = getGeometry(a)
    const gb = getGeometry(b)
    if (
      ga.box.xmin > gb.box.xmax + tolerance ||
      ga.box.xmax < gb.box.xmin - tolerance ||
      ga.box.ymin > gb.box.ymax + tolerance ||
      ga.box.ymax < gb.box.ymin - tolerance
    )
      return false

    // With disjoint boundaries, one point per face determines containment.
    // If boundaries cross elsewhere, the edge tests below detect the contact.
    // Polygon.contains retains the polygon's holes and separate faces.
    if (
      ga.facePoints.some(
        (point) => gb.box.contains(point) && b.contains(point),
      ) ||
      gb.facePoints.some((point) => ga.box.contains(point) && a.contains(point))
    )
      return true

    // Search the larger boundary using the smaller one's edges. Expanded
    // boxes include near contacts; the exact arc/segment distance decides.
    const [small, large] =
      ga.edges.length <= gb.edges.length ? [ga, gb] : [gb, ga]
    const index = getEdgeIndex(large)
    for (const edge of small.edges) {
      const box = edge.box
      for (const i of index.search(
        box.xmin - tolerance,
        box.ymin - tolerance,
        box.xmax + tolerance,
        box.ymax + tolerance,
      )) {
        if (edge.distanceTo(large.edges[i])[0] <= tolerance) return true
      }
    }
    return false
  }
}
