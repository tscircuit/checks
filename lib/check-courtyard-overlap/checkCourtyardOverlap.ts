import {
  areBoundsOverlappingPolygon,
  getBoundsFromPoints,
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

function getCourtyardPolygon(el: CourtyardElement): { x: number; y: number }[] {
  if (el.type === "pcb_courtyard_rect") {
    const hw = el.width / 2
    const hh = el.height / 2
    return [
      { x: el.center.x - hw, y: el.center.y - hh },
      { x: el.center.x + hw, y: el.center.y - hh },
      { x: el.center.x + hw, y: el.center.y + hh },
      { x: el.center.x - hw, y: el.center.y + hh },
    ]
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
          const polyA = getCourtyardPolygon(a)
          const polyB = getCourtyardPolygon(b)
          const boundsA = getBoundsFromPoints(polyA)
          const boundsB = getBoundsFromPoints(polyB)
          if (!boundsA || !boundsB) continue
          if (
            areBoundsOverlappingPolygon(boundsA, polyB) ||
            areBoundsOverlappingPolygon(boundsB, polyA)
          ) {
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
