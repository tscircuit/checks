import { doBoundsOverlap } from "@tscircuit/math-utils"
import type {
  AnyCircuitElement,
  PcbComponent,
  PcbCutout,
  PcbPlacementError,
} from "circuit-json"
import * as Flatten from "@flatten-js/core"
import { applyToPoint, rotateDEG } from "transformation-matrix"
import { getReadableNameForComponent } from "lib/util/get-readable-names"

const CUTOUT_CIRCLE_SEGMENTS = 32

function rectanglePolygon({
  center,
  width,
  height,
  rotation = 0,
}: {
  center: { x: number; y: number }
  width: number
  height: number
  rotation?: number
}) {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const corners = [
    { x: center.x - halfWidth, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y + halfHeight },
    { x: center.x - halfWidth, y: center.y + halfHeight },
  ]
  const matrix = rotateDEG(rotation, center.x, center.y)

  return new Flatten.Polygon(
    corners.map((corner) => {
      const rotated = rotation ? applyToPoint(matrix, corner) : corner
      return new Flatten.Point(rotated.x, rotated.y)
    }),
  )
}

function circlePolygon({
  center,
  radius,
}: {
  center: { x: number; y: number }
  radius: number
}) {
  return new Flatten.Polygon(
    Array.from({ length: CUTOUT_CIRCLE_SEGMENTS }, (_, index) => {
      const angle = (2 * Math.PI * index) / CUTOUT_CIRCLE_SEGMENTS
      return new Flatten.Point(
        center.x + Math.cos(angle) * radius,
        center.y + Math.sin(angle) * radius,
      )
    }),
  )
}

function cutoutToPolygon(cutout: PcbCutout): Flatten.Polygon | null {
  if (cutout.shape === "rect") {
    return rectanglePolygon({
      center: cutout.center,
      width: cutout.width,
      height: cutout.height,
      rotation: cutout.rotation ?? 0,
    })
  }

  if (cutout.shape === "circle") {
    return circlePolygon({ center: cutout.center, radius: cutout.radius })
  }

  if (cutout.shape === "polygon") {
    return new Flatten.Polygon(
      cutout.points.map((point) => new Flatten.Point(point.x, point.y)),
    )
  }

  return null
}

function polygonBoxToBounds(polygon: Flatten.Polygon) {
  return {
    minX: polygon.box.xmin,
    minY: polygon.box.ymin,
    maxX: polygon.box.xmax,
    maxY: polygon.box.ymax,
  }
}

function doPolygonsOverlap(
  polygonA: Flatten.Polygon,
  polygonB: Flatten.Polygon,
) {
  if (
    !doBoundsOverlap(polygonBoxToBounds(polygonA), polygonBoxToBounds(polygonB))
  ) {
    return false
  }
  if (polygonA.contains(polygonB) || polygonB.contains(polygonA)) return true

  try {
    const intersections = Flatten.BooleanOperations.intersect(
      polygonA,
      polygonB,
    )
    if (Array.isArray(intersections)) {
      return intersections.some((polygon) => polygon.area() > 0)
    }
    return intersections.area() > 0
  } catch {
    return false
  }
}

/**
 * Cutouts remove PCB material on every layer, so a component body or SMT pad
 * overlapping a cutout is invalid on both top and bottom.
 */
export function checkPcbComponentOverCutout(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  const cutouts = circuitJson.filter(
    (element): element is PcbCutout => element.type === "pcb_cutout",
  )
  const components = circuitJson.filter(
    (element): element is PcbComponent => element.type === "pcb_component",
  )
  if (cutouts.length === 0 || components.length === 0) return []

  const cutoutPolygons = cutouts
    .map((cutout) => ({ cutout, polygon: cutoutToPolygon(cutout) }))
    .filter(
      (entry): entry is { cutout: PcbCutout; polygon: Flatten.Polygon } =>
        entry.polygon !== null && entry.polygon.area() > 0,
    )
  const errors: PcbPlacementError[] = []

  for (const component of components) {
    if (!component.center || component.width <= 0 || component.height <= 0) {
      continue
    }

    const componentPolygon = rectanglePolygon({
      center: component.center,
      width: component.width,
      height: component.height,
    })
    for (const { cutout, polygon: cutoutPolygon } of cutoutPolygons) {
      if (!doPolygonsOverlap(componentPolygon, cutoutPolygon)) continue

      const componentName = getReadableNameForComponent(
        circuitJson,
        component.pcb_component_id,
      )
      const cutoutId = cutout.pcb_cutout_id

      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `component_over_cutout_${component.pcb_component_id}_${cutoutId}`,
        error_type: "pcb_placement_error",
        message: `Component ${componentName} overlaps with pcb_cutout [${cutoutId}]`,
        subcircuit_id: component.subcircuit_id,
      })
    }
  }

  return errors
}
