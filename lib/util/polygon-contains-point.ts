import * as Flatten from "@flatten-js/core"

interface ShapePoint {
  x: number
  y: number
  constructor: new (x: number, y: number) => unknown
}

interface SegmentLike {
  kind?: "segment"
  name?: string
  start: ShapePoint
  end: ShapePoint
  contains(point: unknown): boolean
}

interface ArcLike {
  kind?: "arc"
  name?: string
  pc: ShapePoint
  r: number
  startAngle: number
  sweep: number
  counterClockwise: boolean
  start: ShapePoint
  end: ShapePoint
  contains(point: unknown): boolean
}

type EdgeShapeLike = SegmentLike | ArcLike

interface PolygonEdgeLike {
  shape: unknown
  prev: PolygonEdgeLike
  next: PolygonEdgeLike
  start: ShapePoint
  end: ShapePoint
}

const isPolygonEdge = (edge: unknown): edge is PolygonEdgeLike =>
  edge instanceof Flatten.Edge ||
  (typeof edge === "object" &&
    edge !== null &&
    "shape" in edge &&
    "prev" in edge &&
    "next" in edge)

const isSegment = (shape: unknown): shape is SegmentLike =>
  shape instanceof Flatten.Segment ||
  (typeof shape === "object" &&
    shape !== null &&
    (shape as { name?: string }).name === "segment")

const isArc = (shape: unknown): shape is ArcLike =>
  shape instanceof Flatten.Arc ||
  (typeof shape === "object" &&
    shape !== null &&
    (shape as { name?: string }).name === "arc")

const asEdgeShape = (shape: unknown): EdgeShapeLike | null => {
  if (isSegment(shape)) return shape
  if (isArc(shape)) return shape
  return null
}

const isArcShape = (shape: EdgeShapeLike): shape is ArcLike =>
  shape instanceof Flatten.Arc ||
  ("sweep" in shape && typeof shape.sweep === "number")

const shapeContainsPoint = (
  shape: SegmentLike | ArcLike,
  point: Flatten.Point,
): boolean => {
  const PointCtor = shape.start.constructor
  const target =
    point instanceof PointCtor ? point : new PointCtor(point.x, point.y)
  return shape.contains(target)
}

const cardinalArcY = (centerY: number, radius: number, quarterTurn: number) => {
  const quadrant = ((quarterTurn % 4) + 4) % 4
  if (quadrant === 1) return centerY + radius
  if (quadrant === 3) return centerY - radius
  return centerY
}

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
    if (!isPolygonEdge(edge)) {
      throw new Error("Expected a polygon edge in the spatial index")
    }
    const shape = asEdgeShape(edge.shape)
    if (!shape) {
      throw new Error("Expected a segment or arc in the polygon")
    }
    // Keep Flatten's boundary tolerance; crossing ownership below is exact.
    if (shapeContainsPoint(shape, point)) return true
    if (!isArcShape(shape)) {
      const { start, end } = shape
      // Half-open y intervals count shared vertices once, including tiny edges.
      if (start.y > point.y === end.y > point.y) continue
      const x =
        start.x + ((point.y - start.y) * (end.x - start.x)) / (end.y - start.y)
      if (x > point.x) inside = !inside
    } else {
      // Split analytically at interior cardinal angles (k * π/2) without
      // Flatten.Arc.breakToFunctional(), which appends a phantom full circle
      // when a counter-clockwise arc ends at 2π.
      const turn = 2 * Math.PI
      const halfPi = Math.PI / 2
      const angleEps = 1e-12
      const startAngle = ((shape.startAngle % turn) + turn) % turn
      const endAngle = shape.counterClockwise
        ? startAngle + shape.sweep
        : startAngle - shape.sweep
      const stops: { angle: number; quarterTurn?: number }[] = [
        { angle: startAngle },
      ]
      if (shape.counterClockwise) {
        for (
          let k = Math.floor(startAngle / halfPi) + 1;
          k * halfPi < endAngle - angleEps;
          k++
        ) {
          stops.push({ angle: k * halfPi, quarterTurn: k })
        }
      } else {
        for (
          let k = Math.ceil(startAngle / halfPi) - 1;
          k * halfPi > endAngle + angleEps;
          k--
        ) {
          stops.push({ angle: k * halfPi, quarterTurn: k })
        }
      }
      stops.push({ angle: endAngle })

      // Use the adjoining segment's existing vertex at an arc/segment join;
      // recomputing it with sin/cos can split one vertex by roundoff.
      const startY = isSegment(edge.prev.shape)
        ? edge.prev.end.y
        : shape.start.y
      const endY = edge.next.start.y
      for (let i = 0; i < stops.length - 1; i++) {
        const fromStop = stops[i]
        const toStop = stops[i + 1]
        const fromY =
          fromStop.quarterTurn !== undefined
            ? cardinalArcY(shape.pc.y, shape.r, fromStop.quarterTurn)
            : startY
        const toY =
          toStop.quarterTurn !== undefined
            ? cardinalArcY(shape.pc.y, shape.r, toStop.quarterTurn)
            : endY
        if (fromY > point.y === toY > point.y) continue
        const dy = point.y - shape.pc.y
        if (Math.abs(dy) > shape.r) continue
        const dx = Math.sqrt((shape.r - dy) * (shape.r + dy))
        const midAngle = (fromStop.angle + toStop.angle) / 2
        const x = shape.pc.x + (Math.cos(midAngle) >= 0 ? dx : -dx)
        if (x > point.x) inside = !inside
      }
    }
  }
  return inside
}
