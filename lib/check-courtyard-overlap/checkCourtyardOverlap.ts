import {
  doSegmentsIntersect,
  isPointInsidePolygon,
} from "@tscircuit/math-utils"
import type {
  AnyCircuitElement,
  PcbCourtyardOverlapError,
  PcbCourtyardRect,
  PcbCourtyardCircle,
  PcbCourtyardOutline,
} from "circuit-json"

type CourtyardElement =
  | PcbCourtyardRect
  | PcbCourtyardCircle
  | PcbCourtyardOutline

function doCourtyardLayersOverlap(
  layerA: CourtyardElement["layer"],
  layerB: CourtyardElement["layer"],
): boolean {
  return layerA === layerB
}

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
  return el.outline
}

function getComponentName(
  circuitJson: AnyCircuitElement[],
  pcbComponentId: string,
): string {
  const pcbComponent = circuitJson.find(
    (el) =>
      el.type === "pcb_component" && el.pcb_component_id === pcbComponentId,
  )
  if (pcbComponent?.type !== "pcb_component") return pcbComponentId
  const sourceComponent = circuitJson.find(
    (el) =>
      el.type === "source_component" &&
      el.source_component_id === pcbComponent.source_component_id,
  )
  if (sourceComponent?.type === "source_component" && sourceComponent.name) {
    return sourceComponent.name
  }
  return pcbComponentId
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
  const courtyards = circuitJson.filter(
    (el): el is CourtyardElement =>
      el.type === "pcb_courtyard_rect" ||
      el.type === "pcb_courtyard_circle" ||
      el.type === "pcb_courtyard_outline",
  )

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
          if (!doCourtyardLayersOverlap(a.layer, b.layer)) continue

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
