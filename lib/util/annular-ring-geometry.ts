import {
  Arc,
  Box,
  Circle,
  Matrix,
  ORIENTATION,
  Point,
  Polygon,
  Segment,
} from "@flatten-js/core"
import type { PcbPlatedHole } from "circuit-json"

/**
 * Exact annular-ring geometry in board-world millimeters (+X right, +Y up,
 * rotations CCW), distilled from the verified measurement used by the DFM
 * design-rule work: analytic circles and capsules, rounded and polygon pads,
 * with the drill placed the way the Gerber/Excellon writers place it — at
 * `(x + hole_offset_x, y + hole_offset_y)`, slots rotated by
 * `hole_ccw_rotation ?? ccw_rotation`, polygon pads by `ccw_rotation`, else
 * the owning component's rotation, else axis-aligned.
 *
 * Elliptical pads and drills (unequal oval axes) have no exact distance
 * formula here and stay unmeasurable rather than approximated.
 */
export type AnnularRingMeasurement =
  | { status: "ready"; annularRing: number }
  | { status: "breakout" }

export type AnnularRingResult =
  | {
      status: "unmeasurable"
      reason: "missing_input" | "unsupported"
      message: string
    }
  | (AnnularRingMeasurement & { drillDiameter?: number })

type Unmeasurable = Extract<AnnularRingResult, { status: "unmeasurable" }>

type DrillOutline =
  | { status: "ok"; polygon: Polygon; drillDiameter?: number }
  | Unmeasurable

const unmeasurable = (
  reason: "missing_input" | "unsupported",
  message: string,
): Unmeasurable => ({ status: "unmeasurable", reason, message })

const ccw = (polygon: Polygon) =>
  polygon.orientation() === ORIENTATION.CCW ? polygon : polygon.reverse()

const circlePolygon = (center: { x: number; y: number }, radius: number) =>
  ccw(new Polygon(new Circle(new Point(center.x, center.y), radius)))

/** Rotates a polygon about the origin, then moves it to its board position. */
const placePolygon = ({
  polygon,
  center,
  ccwRotationDegrees = 0,
}: {
  polygon: Polygon
  center: { x: number; y: number }
  ccwRotationDegrees?: number
}) => {
  const ccwRotationRadians = (ccwRotationDegrees * Math.PI) / 180
  const cos = Math.cos(ccwRotationRadians)
  const sin = Math.sin(ccwRotationRadians)
  return polygon.transform(new Matrix(cos, sin, -sin, cos, center.x, center.y))
}

/** A rectangle with fully rounded corners is the pill/stadium outline. */
const roundedRectangle = ({
  center,
  width,
  height,
  radius = 0,
  ccwRotationDegrees = 0,
}: {
  center: { x: number; y: number }
  width: number
  height: number
  radius?: number
  ccwRotationDegrees?: number
}) => {
  const x = width / 2
  const y = height / 2
  const r = Math.max(0, Math.min(radius, x, y))
  if (r === 0)
    return placePolygon({
      polygon: ccw(new Polygon(new Box(-x, -y, x, y))),
      center,
      ccwRotationDegrees,
    })
  const arcs = [
    new Arc(new Point(x - r, -y + r), r, -Math.PI / 2, 0, true),
    new Arc(new Point(x - r, y - r), r, 0, Math.PI / 2, true),
    new Arc(new Point(-x + r, y - r), r, Math.PI / 2, Math.PI, true),
    new Arc(new Point(-x + r, -y + r), r, Math.PI, Math.PI * 1.5, true),
  ]
  const edges: Array<Arc | Segment> = []
  for (let i = 0; i < arcs.length; i++) {
    const arc = arcs[i]!
    const next = arcs[(i + 1) % arcs.length]!
    edges.push(arc)
    if (arc.end.distanceTo(next.start)[0] > 1e-12)
      edges.push(new Segment(arc.end, next.start))
  }
  return placePolygon({
    polygon: ccw(new Polygon(edges)),
    center,
    ccwRotationDegrees,
  })
}

/**
 * Positive uniform scaling that scales every analytic edge explicitly.
 * Flatten's generic `Arc.transform` rebuilds coincident full-circle endpoints
 * as CCW, which can flip a clockwise face into added material.
 */
const scalePolygon = (polygon: Polygon, factor: number) => {
  const point = (p: Point) => new Point(p.x * factor, p.y * factor)
  const result = new Polygon()
  for (const face of polygon.faces)
    result.addFace(
      face.shapes.map((shape: Arc | Segment) =>
        shape instanceof Arc
          ? new Arc(
              point(shape.pc),
              shape.r * factor,
              shape.startAngle,
              shape.endAngle,
              shape.counterClockwise,
            )
          : new Segment(point(shape.start), point(shape.end)),
      ),
    )
  return result
}

/** Numerical predicates run enlarged so mm-scale tolerance cannot merge
 * distinct boundaries (a 0.025mm ring must stay distinguishable from zero). */
const MEASUREMENT_SCALE = 1e6

/**
 * Narrowest copper between the drill wall and the pad edge: the smallest
 * distance between the two outlines, or `breakout` when any drill edge is not
 * covered by the pad. Tangency measures as zero; a breakout never gets a
 * fabricated penetration number.
 */
export function measureAnnularRing(
  pad: Polygon,
  drill: Polygon,
): AnnularRingMeasurement | undefined {
  try {
    if (
      !pad.isValid() ||
      pad.area() <= 0 ||
      !drill.isValid() ||
      drill.area() <= 0
    )
      return undefined
    const largePad = scalePolygon(pad, MEASUREMENT_SCALE)
    const largeDrill = scalePolygon(drill, MEASUREMENT_SCALE)
    // Every drill edge must be covered by the filled pad; a polygon-to-polygon
    // cover test misclassifies coincident full-circle faces.
    for (const edge of largeDrill.edges)
      if (!largePad.contains(edge.shape)) return { status: "breakout" }
    let minimum = Number.POSITIVE_INFINITY
    for (const padEdge of largePad.edges)
      for (const drillEdge of largeDrill.edges) {
        const padShape = padEdge.shape
        const drillShape = drillEdge.shape
        const distance =
          padShape instanceof Arc &&
          drillShape instanceof Arc &&
          Math.abs(padShape.sweep - 2 * Math.PI) < 1e-9 &&
          Math.abs(drillShape.sweep - 2 * Math.PI) < 1e-9
            ? Math.max(
                0,
                Math.abs(padShape.r - drillShape.r) -
                  Math.hypot(
                    padShape.pc.x - drillShape.pc.x,
                    padShape.pc.y - drillShape.pc.y,
                  ),
                Math.hypot(
                  padShape.pc.x - drillShape.pc.x,
                  padShape.pc.y - drillShape.pc.y,
                ) -
                  padShape.r -
                  drillShape.r,
              )
            : padShape.intersect(drillShape).length > 0
              ? 0
              : padShape.distanceTo(drillShape)[0]
        minimum = Math.min(minimum, distance)
      }
    if (!Number.isFinite(minimum) || minimum < 0) return undefined
    return { status: "ready", annularRing: minimum / MEASUREMENT_SCALE }
  } catch {
    return undefined
  }
}

const finite = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value)

const positive = (...values: Array<number | undefined>) =>
  values.every((value) => finite(value) && value > 0)

/**
 * Circle when width equals height, capsule otherwise. Capsules stay analytic
 * (two arcs plus two segments), so small rings never depend on tessellation.
 */
const drillCapsule = ({
  center,
  width,
  height,
  ccwRotationDegrees = 0,
}: {
  center: { x: number; y: number }
  width: number
  height: number
  ccwRotationDegrees?: number
}) =>
  width === height
    ? circlePolygon(center, width / 2)
    : roundedRectangle({
        center,
        width,
        height,
        radius: Math.min(width, height) / 2,
        ccwRotationDegrees,
      })

/** The actual drilled outline at its written, offset position. */
const getPlatedHoleDrill = (
  hole: PcbPlatedHole,
  componentCcwRotationDegrees?: number,
): DrillOutline => {
  if (hole.shape === "circle") {
    if (!finite(hole.hole_diameter))
      return unmeasurable("missing_input", "drill diameter is missing")
    if (!positive(hole.hole_diameter))
      return unmeasurable(
        "unsupported",
        "drill diameter must be positive and finite",
      )
    return {
      status: "ok",
      polygon: circlePolygon(hole, hole.hole_diameter / 2),
      drillDiameter: hole.hole_diameter,
    }
  }
  if (hole.shape === "pill" || hole.shape === "oval") {
    if (!finite(hole.hole_width) || !finite(hole.hole_height))
      return unmeasurable("missing_input", "drill dimensions are missing")
    if (hole.shape === "oval" && hole.hole_width !== hole.hole_height)
      return unmeasurable(
        "unsupported",
        "elliptical drills have no exact measurement here",
      )
    // `ccw_rotation` is schema-required for this shape; every consumer
    // defaults an absent value to 0, so measure the slot the same way.
    return {
      status: "ok",
      polygon: drillCapsule({
        center: hole,
        width: hole.hole_width,
        height: hole.hole_height,
        ccwRotationDegrees: hole.ccw_rotation ?? 0,
      }),
    }
  }
  // The remaining shapes place their drill at the written hole offsets.
  const center = {
    x:
      hole.x +
      ("hole_offset_x" in hole && finite(hole.hole_offset_x)
        ? hole.hole_offset_x
        : 0),
    y:
      hole.y +
      ("hole_offset_y" in hole && finite(hole.hole_offset_y)
        ? hole.hole_offset_y
        : 0),
  }
  if (
    hole.shape === "circular_hole_with_rect_pad" ||
    (hole.shape === "hole_with_polygon_pad" && hole.hole_shape === "circle")
  ) {
    if (!finite(hole.hole_diameter))
      return unmeasurable("missing_input", "drill diameter is missing")
    if (!positive(hole.hole_diameter))
      return unmeasurable(
        "unsupported",
        "drill diameter must be positive and finite",
      )
    return {
      status: "ok",
      polygon: circlePolygon(center, hole.hole_diameter / 2),
      drillDiameter: hole.hole_diameter,
    }
  }
  if (
    hole.shape === "hole_with_polygon_pad" &&
    hole.hole_shape === "oval" &&
    hole.hole_width !== hole.hole_height
  )
    return unmeasurable(
      "unsupported",
      "elliptical drills have no exact measurement here",
    )
  if (
    hole.shape === "pill_hole_with_rect_pad" ||
    hole.shape === "rotated_pill_hole_with_rect_pad" ||
    hole.shape === "hole_with_polygon_pad"
  ) {
    if (!finite(hole.hole_width) || !finite(hole.hole_height))
      return unmeasurable("missing_input", "drill dimensions are missing")
    // This shape's whole identity is its rotation, and `hole_ccw_rotation` is
    // schema-required for it: keep refusing a slot without one.
    if (
      hole.shape === "rotated_pill_hole_with_rect_pad" &&
      hole.hole_ccw_rotation === undefined &&
      hole.hole_width !== hole.hole_height
    )
      return unmeasurable(
        "missing_input",
        "a rotated slot requires its rotation",
      )
    const slotCcwRotationDegrees =
      hole.shape === "rotated_pill_hole_with_rect_pad"
        ? hole.hole_ccw_rotation
        : hole.shape === "hole_with_polygon_pad"
          ? (hole.ccw_rotation ?? componentCcwRotationDegrees ?? 0)
          : 0
    // An equal-axis capsule (including polygon-pad ovals) is a circular drill
    return {
      status: "ok",
      polygon: drillCapsule({
        center,
        width: hole.hole_width,
        height: hole.hole_height,
        ccwRotationDegrees: slotCcwRotationDegrees,
      }),
    }
  }
  return unmeasurable("unsupported", "the plated drill shape is not supported")
}

/** The independently placed copper pad outline. */
const getPlatedHolePad = (
  hole: PcbPlatedHole,
  componentCcwRotationDegrees?: number,
): { status: "ok"; polygon: Polygon } | Unmeasurable => {
  if (hole.shape === "circle") {
    if (!finite(hole.outer_diameter))
      return unmeasurable("missing_input", "pad diameter is missing")
    if (!positive(hole.outer_diameter))
      return unmeasurable(
        "unsupported",
        "pad diameter must be positive and finite",
      )
    return {
      status: "ok",
      polygon: circlePolygon(hole, hole.outer_diameter / 2),
    }
  }
  if (hole.shape === "pill" || hole.shape === "oval") {
    if (!finite(hole.outer_width) || !finite(hole.outer_height))
      return unmeasurable("missing_input", "pad dimensions are missing")
    if (hole.shape === "oval" && hole.outer_width !== hole.outer_height)
      return unmeasurable(
        "unsupported",
        "elliptical pads have no exact measurement here",
      )
    // `ccw_rotation` is schema-required for this shape, so an absent value is
    // malformed JSON; every consumer (core, circuit-json-util, copper-pour
    // solver, circuit-to-svg) treats it as 0, so measure the same way.
    return {
      status: "ok",
      polygon: roundedRectangle({
        center: hole,
        width: hole.outer_width,
        height: hole.outer_height,
        radius: Math.min(hole.outer_width, hole.outer_height) / 2,
        ccwRotationDegrees: hole.ccw_rotation ?? 0,
      }),
    }
  }
  if (hole.shape === "hole_with_polygon_pad") {
    const outline = hole.pad_outline
    if (!outline || outline.length < 3)
      return unmeasurable("missing_input", "polygon pad outline is missing")
    if (!outline.every((point) => finite(point.x) && finite(point.y)))
      return unmeasurable("unsupported", "polygon pad points must be finite")
    // Match getPlatedHolePolygon: fall back to the component rotation, then to 0.
    const padCcwRotationDegrees =
      hole.ccw_rotation ?? componentCcwRotationDegrees ?? 0
    return {
      status: "ok",
      polygon: placePolygon({
        polygon: ccw(
          new Polygon(outline.map((point) => new Point(point.x, point.y))),
        ),
        center: hole,
        ccwRotationDegrees: padCcwRotationDegrees,
      }),
    }
  }
  if (
    hole.shape === "circular_hole_with_rect_pad" ||
    hole.shape === "pill_hole_with_rect_pad" ||
    hole.shape === "rotated_pill_hole_with_rect_pad"
  ) {
    if (!positive(hole.rect_pad_width, hole.rect_pad_height))
      return unmeasurable(
        finite(hole.rect_pad_width) && finite(hole.rect_pad_height)
          ? "unsupported"
          : "missing_input",
        "rectangular pad dimensions are missing or not positive",
      )
    const radius = hole.rect_border_radius ?? 0
    const padCcwRotationDegrees =
      "rect_ccw_rotation" in hole ? hole.rect_ccw_rotation : undefined
    if (
      hole.shape === "rotated_pill_hole_with_rect_pad" &&
      padCcwRotationDegrees === undefined
    )
      return unmeasurable(
        "missing_input",
        "a rotated rectangular pad requires its rotation",
      )
    if (
      !finite(radius) ||
      radius < 0 ||
      (padCcwRotationDegrees !== undefined && !finite(padCcwRotationDegrees))
    )
      return unmeasurable(
        "unsupported",
        "pad radius and rotation must be finite and valid",
      )
    return {
      status: "ok",
      polygon: roundedRectangle({
        center: hole,
        width: hole.rect_pad_width,
        height: hole.rect_pad_height,
        radius,
        ccwRotationDegrees: padCcwRotationDegrees ?? 0,
      }),
    }
  }
  return unmeasurable("unsupported", "the plated pad shape is not supported")
}

/**
 * Measures the copper ring around a via's drill. `drillDiameter` is present
 * for circular drills so callers can apply drill-diameter minimums.
 */
export function getViaAnnularRing(via: {
  x: number
  y: number
  hole_diameter: number
  outer_diameter: number
}): AnnularRingResult {
  if (!positive(via.hole_diameter, via.outer_diameter))
    return unmeasurable(
      "unsupported",
      "via drill and pad diameters must be positive and finite",
    )
  const measurement = measureAnnularRing(
    circlePolygon(via, via.outer_diameter / 2),
    circlePolygon(via, via.hole_diameter / 2),
  )
  if (!measurement)
    return unmeasurable(
      "unsupported",
      "the via annular geometry could not be evaluated",
    )
  return { ...measurement, drillDiameter: via.hole_diameter }
}

/** Measures the copper ring around a plated hole's actual drill. */
export function getPlatedHoleAnnularRing(
  hole: PcbPlatedHole,
  componentCcwRotationDegrees?: number,
): AnnularRingResult {
  if (![hole.x, hole.y].every(Number.isFinite))
    return unmeasurable(
      "unsupported",
      "annular geometry requires finite coordinates",
    )
  const drill = getPlatedHoleDrill(hole, componentCcwRotationDegrees)
  if (drill.status !== "ok") return drill
  const pad = getPlatedHolePad(hole, componentCcwRotationDegrees)
  if (pad.status !== "ok") return pad
  const measurement = measureAnnularRing(pad.polygon, drill.polygon)
  if (!measurement)
    return unmeasurable(
      "unsupported",
      "the annular geometry could not be evaluated",
    )
  return {
    ...measurement,
    ...(drill.drillDiameter !== undefined
      ? { drillDiameter: drill.drillDiameter }
      : {}),
  }
}
