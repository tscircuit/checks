import { Box } from "@flatten-js/core"
import { convertCircuitJsonElementToFlattenJs } from "@tscircuit/circuit-json-to-flattenjs"
import type { AnyCircuitElement, Point } from "circuit-json"

type CopperEnvelopePoint = Point & { radius: number }

function encloseCopperPoints(points: CopperEnvelopePoint[]): Box | undefined {
  if (
    points.length === 0 ||
    points.some(
      (point) =>
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        !Number.isFinite(point.radius) ||
        point.radius <= 0,
    )
  )
    return undefined

  // A segment uses its starting width at BOTH ends. Pad every point with the
  // maximum radius so a narrower following point cannot shrink the envelope.
  const radius = points.reduce(
    (largest, point) => Math.max(largest, point.radius),
    0,
  )
  let bounds: Box | undefined
  for (const point of points) {
    const pointBounds = new Box(
      point.x - radius,
      point.y - radius,
      point.x + radius,
      point.y + radius,
    )
    bounds = bounds ? bounds.merge(pointBounds) : pointBounds
  }
  return bounds &&
    [bounds.xmin, bounds.ymin, bounds.xmax, bounds.ymax].every(Number.isFinite)
    ? bounds
    : undefined
}

/**
 * Conservative XY envelope for geometry the converter could not represent.
 * Board/circuit points are in mm, +X right and +Y up; no layer mirroring.
 * These bounds only rule out distant pairs; they never establish clearance.
 * Unknown dimensions/positions remain unbounded and must retain a diagnostic.
 */
export function getConservativeCutoutClearanceBounds(
  element: AnyCircuitElement,
  circuitJson: AnyCircuitElement[],
): Box | undefined {
  // An invalid drill may still have a valid outer copper envelope.
  const envelope = convertCircuitJsonElementToFlattenJs(element, {
    circuitJson,
    includeDrillHoles: false,
  }).bounds
  if (envelope) return envelope

  if (element.type === "pcb_cutout" && element.shape === "path") {
    // A patterned slot is contained by the equivalent continuous round slot.
    // Custom corner geometry is not covered by this bound.
    if (element.slot_corner_radius !== undefined) return undefined
    return convertCircuitJsonElementToFlattenJs(
      {
        ...element,
        slot_length: undefined,
        space_between_slots: undefined,
      },
      { circuitJson },
    ).bounds
  }

  if (element.type === "pcb_trace") {
    // A missing layer transition can prevent conversion while all XY copper
    // extents are still known. Include wire widths, through-pad ends and vias.
    const points = element.route.flatMap<CopperEnvelopePoint>((point) => {
      if (point.route_type === "through_pad") {
        return [point.start, point.end].map((endpoint) => ({
          ...endpoint,
          radius: point.width / 2,
        }))
      }
      return [
        {
          x: point.x,
          y: point.y,
          radius:
            point.route_type === "via"
              ? (point.outer_diameter ?? NaN) / 2
              : Math.max(
                  point.width,
                  point.start_width ?? 0,
                  point.end_width ?? 0,
                ) / 2,
        },
      ]
    })
    return encloseCopperPoints(points)
  }
  return undefined
}
