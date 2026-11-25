import { segmentToSegmentMinDistance } from "@tscircuit/math-utils"
import type { PcbTrace } from "circuit-json"
import { getClosestPointBetweenSegments } from "./check-each-pcb-trace-non-overlapping/getClosestPointBetweenSegments"

type RoutePoint =
  | { route_type: "wire"; x: number; y: number; width: number; layer: string }
  | {
      route_type: "via"
      x: number
      y: number
      outer_diameter?: number
      layers: readonly string[]
    }
  | Exclude<PcbTrace["route"][number], { route_type: "wire" | "via" }>

type Segment = {
  x1: number
  y1: number
  x2: number
  y2: number
  thickness: number
  layer: string
  startDistance: number
  endDistance: number
  run: number
}

/** First nonlocal copper contact along one trace, in board-world millimeters. */
export function getPcbTraceSelfShortLocation(route: readonly RoutePoint[]) {
  const segments: Segment[] = []
  const routeDistances: number[] = []
  let distance = 0
  let run = 0
  for (let i = 0; i < route.length - 1; i++) {
    routeDistances[i] = distance
    const a = route[i]!
    const b = route[i + 1]!
    if (
      a.route_type !== "wire" ||
      b.route_type !== "wire" ||
      a.layer !== b.layer
    ) {
      run++
      continue
    }
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (length === 0) continue
    segments.push({
      thickness: a.width,
      layer: a.layer,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      run,
      startDistance: distance,
      endDistance: distance + length,
    })
    distance += length
  }

  routeDistances[route.length - 1] = distance
  let shortCenter: { x: number; y: number } | undefined

  pairs: for (let i = 0; i < segments.length; i++) {
    const a = segments[i]!
    for (let j = i + 1; j < segments.length; j++) {
      const b = segments[j]!
      if (a.layer !== b.layer) continue
      const contactDistance = (a.thickness + b.thickness) / 2
      // Neighboring copper naturally overlaps at bends, including bends
      // subdivided into several short segments. Only test nonlocal contact.
      const dot = (a.x2 - a.x1) * (b.x2 - b.x1) + (a.y2 - a.y1) * (b.y2 - b.y1)
      const cross =
        (a.x2 - a.x1) * (b.y2 - b.y1) - (a.y2 - a.y1) * (b.x2 - b.x1)
      const directionLengthProduct =
        Math.hypot(a.x2 - a.x1, a.y2 - a.y1) *
        Math.hypot(b.x2 - b.x1, b.y2 - b.y1)
      // Compare normalized directions: roundoff can make a right-angle dot
      // product slightly negative, especially at tiny chamfer segments.
      const isForwardOrRightAngle = dot >= -1e-9 * directionLengthProduct
      const adjacent = a.run === b.run && b.startDistance === a.endDistance
      // An immediately retraced segment is a short too; ordinary adjacent
      // bends share copper intentionally.
      if (adjacent && !(dot < 0 && Math.abs(cross) < 1e-9)) continue
      if (
        !adjacent &&
        a.run === b.run &&
        // A right-angle connector can have sqrt(2) times the straight-line
        // distance. Its local copper overlap is still part of the same bend.
        b.startDistance - a.endDistance <= Math.SQRT2 * contactDistance &&
        isForwardOrRightAngle
      )
        continue
      const gap =
        segmentToSegmentMinDistance(
          { x: a.x1, y: a.y1 },
          { x: a.x2, y: a.y2 },
          { x: b.x1, y: b.y1 },
          { x: b.x2, y: b.y2 },
        ) - contactDistance
      if (gap > 1e-9) continue
      shortCenter = getClosestPointBetweenSegments(a, b)
      break pairs
    }
  }
  // Via copper can contact a distant section even when wire centerlines do
  // not cross. Use route position to distinguish the intentional entry/exit
  // from contact that bypasses a detour.
  if (!shortCenter) {
    vias: for (let i = 0; i < route.length; i++) {
      const point = route[i]!
      if (point.route_type !== "via") continue
      const { outer_diameter: diameter, layers } = point
      if (diameter === undefined || !Number.isFinite(diameter) || diameter <= 0)
        continue
      for (const segment of segments) {
        if (!layers.includes(segment.layer)) continue
        const reach = (diameter + segment.thickness) / 2
        const alongRouteGap = Math.max(
          segment.startDistance - routeDistances[i]!,
          routeDistances[i]! - segment.endDistance,
          0,
        )
        // Includes subdivided entry/exit segments inside the via land.
        if (alongRouteGap <= reach + 1e-9) continue
        const viaSegment = {
          ...segment,
          x1: point.x,
          y1: point.y,
          x2: point.x,
          y2: point.y,
        }
        const gap =
          segmentToSegmentMinDistance(
            point,
            point,
            { x: segment.x1, y: segment.y1 },
            { x: segment.x2, y: segment.y2 },
          ) - reach
        if (gap > 1e-9) continue
        shortCenter = getClosestPointBetweenSegments(segment, viaSegment)
        break vias
      }
    }
  }
  return shortCenter
}
