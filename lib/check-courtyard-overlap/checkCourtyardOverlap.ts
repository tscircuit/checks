import { getReadableNameForComponent } from "lib/util/get-readable-names"
import {
  doSegmentsIntersect,
  isPointInsidePolygon,
} from "@tscircuit/math-utils"
import type {
  AnyCircuitElement,
  PcbCourtyardCircle,
  PcbCourtyardOutline,
  PcbCourtyardOverlapError,
  PcbCourtyardPill,
  PcbCourtyardPolygon,
  PcbCourtyardRect,
} from "circuit-json"

type CourtyardElement =
  | PcbCourtyardRect
  | PcbCourtyardCircle
  | PcbCourtyardOutline
  | PcbCourtyardPolygon
  | PcbCourtyardPill

function getCourtyardPolygon(el: CourtyardElement): { x: number; y: number }[] {
  if (el.type === "pcb_courtyard_rect") {
    const hw = el.width / 2
    const hh = el.height / 2
    const corners = [
      { x: -hw, y: -hh },
      { x: +hw, y: -hh },
      { x: +hw, y: +hh },
      { x: -hw, y: +hh },
    ]
    const angle = ((el.ccw_rotation ?? 0) * Math.PI) / 180
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return corners.map(({ x, y }) => ({
      x: el.center.x + x * cos - y * sin,
      y: el.center.y + x * sin + y * cos,
    }))
  }
  if (el.type === "pcb_courtyard_circle") {
    const N = 32
    return Array.from({ length: N }, (_, i) => {
      const a = (2 * Math.PI * i) / N
      return {
        x: el.center.x + el.radius * Math.cos(a),
        y: el.center.y + el.radius * Math.sin(a),
      }
    })
  }
  if (el.type === "pcb_courtyard_pill") {
    const r = Math.min(el.radius, Math.min(el.width, el.height) / 2)
    const halfArcSegments = 16
    const localPoints: { x: number; y: number }[] = []

    if (el.width >= el.height) {
      const halfSpan = Math.max(0, el.width / 2 - r)
      for (let i = 0; i <= halfArcSegments; i++) {
        const a = -Math.PI / 2 + (Math.PI * i) / halfArcSegments
        localPoints.push({
          x: halfSpan + r * Math.cos(a),
          y: r * Math.sin(a),
        })
      }
      for (let i = 0; i <= halfArcSegments; i++) {
        const a = Math.PI / 2 + (Math.PI * i) / halfArcSegments
        localPoints.push({
          x: -halfSpan + r * Math.cos(a),
          y: r * Math.sin(a),
        })
      }
    } else {
      const halfSpan = Math.max(0, el.height / 2 - r)
      for (let i = 0; i <= halfArcSegments; i++) {
        const a = (Math.PI * i) / halfArcSegments
        localPoints.push({
          x: r * Math.cos(a),
          y: halfSpan + r * Math.sin(a),
        })
      }
      for (let i = 0; i <= halfArcSegments; i++) {
        const a = Math.PI + (Math.PI * i) / halfArcSegments
        localPoints.push({
          x: r * Math.cos(a),
          y: -halfSpan + r * Math.sin(a),
        })
      }
    }

    const ccwRotation =
      "ccw_rotation" in el && typeof el.ccw_rotation === "number"
        ? el.ccw_rotation
        : 0
    const angle = (ccwRotation * Math.PI) / 180
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return localPoints.map(({ x, y }) => ({
      x: el.center.x + x * cos - y * sin,
      y: el.center.y + x * sin + y * cos,
    }))
  }
  if (el.type === "pcb_courtyard_polygon") {
    return el.points
  }
  return el.outline
}

function getComponentName(
  circuitJson: AnyCircuitElement[],
  pcbComponentId: string,
): string {
  return getReadableNameForComponent(circuitJson, pcbComponentId)
}

type Point = { x: number; y: number }

function polygonsOverlap(polyA: Point[], polyB: Point[]): boolean {
  // Check if any vertex of A is inside B or vice versa
  if (polyA.some((p) => isPointInsidePolygon(p, polyB))) return true
  if (polyB.some((p) => isPointInsidePolygon(p, polyA))) return true
  // Check if any edge of A intersects any edge of B
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i]
    const a2 = polyA[(i + 1) % polyA.length]
    for (let j = 0; j < polyB.length; j++) {
      const b1 = polyB[j]
      const b2 = polyB[(j + 1) % polyB.length]
      if (doSegmentsIntersect(a1, a2, b1, b2)) return true
    }
  }
  return false
}

/**
 * Check for overlapping PCB component courtyards.
 * Returns one error per pair of components whose courtyard elements overlap.
 */
export function checkCourtyardOverlap(
  circuitJson: AnyCircuitElement[],
): PcbCourtyardOverlapError[] {
  const doNotPlaceComponentIds = new Set(
    circuitJson.flatMap((el) =>
      el.type === "pcb_component" && el.do_not_place
        ? [el.pcb_component_id]
        : [],
    ),
  )

  const courtyards = circuitJson
    .filter(
      (el): el is CourtyardElement =>
        el.type === "pcb_courtyard_rect" ||
        el.type === "pcb_courtyard_circle" ||
        el.type === "pcb_courtyard_outline" ||
        el.type === "pcb_courtyard_polygon" ||
        el.type === "pcb_courtyard_pill",
    )
    .filter((el) => !doNotPlaceComponentIds.has(el.pcb_component_id))

  // Group by component
  const byComponent = new Map<string, CourtyardElement[]>()
  for (const el of courtyards) {
    const id = el.pcb_component_id
    if (!byComponent.has(id)) byComponent.set(id, [])
    byComponent.get(id)!.push(el)
  }

  const componentIds = Array.from(byComponent.keys())
  const errors: PcbCourtyardOverlapError[] = []

  for (let i = 0; i < componentIds.length; i++) {
    for (let j = i + 1; j < componentIds.length; j++) {
      const idA = componentIds[i]
      const idB = componentIds[j]

      let overlapping = false
      outer: for (const a of byComponent.get(idA)!) {
        for (const b of byComponent.get(idB)!) {
          // Skip overlap check if courtyards are on different layers
          if ("layer" in a && "layer" in b && a.layer !== b.layer) {
            continue
          }
          const polyA = getCourtyardPolygon(a)
          const polyB = getCourtyardPolygon(b)
          if (polygonsOverlap(polyA, polyB)) {
            overlapping = true
            break outer
          }
        }
      }

      if (overlapping) {
        errors.push({
          type: "pcb_courtyard_overlap_error",
          pcb_error_id: `pcb_courtyard_overlap_${idA}_${idB}`,
          error_type: "pcb_courtyard_overlap_error",
          message: `Courtyard of ${getComponentName(circuitJson, idA)} overlaps with courtyard of ${getComponentName(circuitJson, idB)}`,
          pcb_component_ids: [idA, idB],
        })
      }
    }
  }

  return errors
}
