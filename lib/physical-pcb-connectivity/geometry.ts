import { distanceBetweenShapes } from "@tscircuit/circuit-json-util"
import {
  doesLineIntersectLine,
  isPointInsidePolygon,
  pointToSegmentDistance,
  type Point,
} from "@tscircuit/math-utils"
import type {
  LayerRef,
  PcbCopperPour,
  PcbGroundPlaneRegion,
  PcbTrace,
} from "circuit-json"
import type { PcbTraceSegment } from "lib/check-each-pcb-trace-non-overlapping/getCollidableBounds"
import {
  getRotatedRectPoints,
  getSegmentToPolygonClearanceFromPoints,
} from "lib/check-each-pcb-trace-non-overlapping/segment-to-polygon-clearance"
import {
  getTraceObstacleClearance,
  isTraceObstacleOverlap,
  type TraceClearanceObstacle,
} from "lib/check-pad-clearance/common"
import { isPointInPad } from "lib/check-traces-are-contiguous/is-point-in-pad"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import {
  physicalContactToleranceMm,
  type CopperRegionGeometry,
  type PcbTraceId,
} from "./types"

export function getCopperRegionPoints(
  region: PcbCopperPour | PcbGroundPlaneRegion,
): Point[] {
  if (region.type === "pcb_ground_plane_region") return region.points
  if (region.shape === "polygon") return region.points
  if (region.shape === "brep") {
    return region.brep_shape.outer_ring.vertices.map(({ x, y }) => ({ x, y }))
  }

  return getRotatedRectPoints({
    x: region.center.x,
    y: region.center.y,
    width: region.width,
    height: region.height,
    ccwRotation: region.rotation ?? 0,
  })
}

export function getCopperRegionShape(region: CopperRegionGeometry) {
  return { kind: "polygon" as const, points: region.points }
}

export function getSegmentsByTraceId(
  segments: PcbTraceSegment[],
): Map<PcbTraceId, PcbTraceSegment[]> {
  const segmentsByTraceId = new Map<PcbTraceId, PcbTraceSegment[]>()
  for (const segment of segments) {
    segmentsByTraceId.set(segment.pcb_trace_id, [
      ...(segmentsByTraceId.get(segment.pcb_trace_id) ?? []),
      segment,
    ])
  }
  return segmentsByTraceId
}

export function doTraceSegmentsTouch({
  firstSegments,
  secondSegments,
}: {
  firstSegments: PcbTraceSegment[]
  secondSegments: PcbTraceSegment[]
}): boolean {
  for (const firstSegment of firstSegments) {
    for (const secondSegment of secondSegments) {
      if (firstSegment.layer !== secondSegment.layer) continue
      if (
        doesLineIntersectLine(
          [
            { x: firstSegment.x1, y: firstSegment.y1 },
            { x: firstSegment.x2, y: firstSegment.y2 },
          ],
          [
            { x: secondSegment.x1, y: secondSegment.y1 },
            { x: secondSegment.x2, y: secondSegment.y2 },
          ],
          {
            lineThickness:
              (firstSegment.thickness + secondSegment.thickness) / 2,
          },
        )
      ) {
        return true
      }
    }
  }
  return false
}

export function doesTraceTouchObstacle({
  trace,
  segments,
  obstacle,
}: {
  trace: PcbTrace
  segments: PcbTraceSegment[]
  obstacle: TraceClearanceObstacle
}): boolean {
  const obstacleLayers = getLayersOfPcbElement(obstacle)
  if (
    segments.some(
      (segment) =>
        obstacleLayers.includes(segment.layer) &&
        isTraceObstacleOverlap(
          getTraceObstacleClearance(segment, obstacle).gap +
            physicalContactToleranceMm,
        ),
    )
  ) {
    return true
  }

  return trace.route.some((routePoint) => {
    if (routePoint.route_type !== "wire") return false
    if (!obstacleLayers.includes(routePoint.layer)) return false
    if (obstacle.type === "pcb_via") {
      return (
        Math.hypot(routePoint.x - obstacle.x, routePoint.y - obstacle.y) <=
        routePoint.width / 2 +
          obstacle.outer_diameter / 2 +
          physicalContactToleranceMm
      )
    }
    return isPointInPad(routePoint, obstacle)
  })
}

export function getTraceLayersTouchingPoint({
  trace,
  segments,
  point,
}: {
  trace: PcbTrace
  segments: PcbTraceSegment[]
  point: Point
}): Set<LayerRef> {
  const touchingLayers = new Set<LayerRef>()
  for (const segment of segments) {
    if (
      pointToSegmentDistance(
        point,
        { x: segment.x1, y: segment.y1 },
        { x: segment.x2, y: segment.y2 },
      ) <=
      segment.thickness / 2 + physicalContactToleranceMm
    ) {
      touchingLayers.add(segment.layer)
    }
  }

  for (const routePoint of trace.route) {
    if (routePoint.route_type !== "wire") continue
    if (
      Math.hypot(routePoint.x - point.x, routePoint.y - point.y) <=
      routePoint.width / 2 + physicalContactToleranceMm
    ) {
      touchingLayers.add(routePoint.layer)
    }
  }
  return touchingLayers
}

export function doesTraceTouchRegion({
  trace,
  segments,
  region,
}: {
  trace: PcbTrace
  segments: PcbTraceSegment[]
  region: CopperRegionGeometry
}): boolean {
  for (const segment of segments) {
    if (segment.layer !== region.layer) continue
    const clearance = getSegmentToPolygonClearanceFromPoints(
      { x: segment.x1, y: segment.y1 },
      { x: segment.x2, y: segment.y2 },
      region.points,
    )
    if (
      clearance.distance <=
      segment.thickness / 2 + physicalContactToleranceMm
    ) {
      return true
    }
  }

  return trace.route.some((routePoint) => {
    if (routePoint.route_type === "wire") {
      return (
        routePoint.layer === region.layer &&
        isPointInsidePolygon(routePoint, region.points)
      )
    }
    if (routePoint.route_type === "via") {
      return (
        (routePoint.from_layer === region.layer ||
          routePoint.to_layer === region.layer) &&
        isPointInsidePolygon(routePoint, region.points)
      )
    }
    return false
  })
}

export function doLayersOverlap(
  firstLayers: readonly string[],
  secondLayers: readonly string[],
) {
  return firstLayers.some((layer) => secondLayers.includes(layer))
}
