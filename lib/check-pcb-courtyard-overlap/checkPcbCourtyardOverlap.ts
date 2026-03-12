import {
  getBoundsOfPcbElements,
  getPrimaryId,
} from "@tscircuit/circuit-json-util"
import { doBoundsOverlap } from "@tscircuit/math-utils"
import type {
  AnyCircuitElement,
  PcbCourtyardCircle,
  PcbCourtyardOutline,
  PcbCourtyardPolygon,
  PcbCourtyardRect,
  PcbCourtyardOverlapError,
} from "circuit-json"

function getComponentName(
  circuitJson: AnyCircuitElement[],
  pcbComponentId: string,
): string {
  const pcbComponent = circuitJson.find(
    (el) =>
      el.type === "pcb_component" && el.pcb_component_id === pcbComponentId,
  )
  if (!pcbComponent || pcbComponent.type !== "pcb_component") {
    return pcbComponentId
  }
  const sourceComponent = circuitJson.find(
    (el) =>
      el.type === "source_component" &&
      el.source_component_id === pcbComponent.source_component_id,
  )
  if (!sourceComponent || sourceComponent.type !== "source_component") {
    return pcbComponentId
  }
  return sourceComponent.name ?? pcbComponentId
}

type CourtyardElement =
  | PcbCourtyardRect
  | PcbCourtyardOutline
  | PcbCourtyardPolygon
  | PcbCourtyardCircle

interface ComponentCourtyard {
  component_id: string
  elements: CourtyardElement[]
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
}

function isCourtyardElement(el: AnyCircuitElement): el is CourtyardElement {
  return (
    el.type === "pcb_courtyard_rect" ||
    el.type === "pcb_courtyard_outline" ||
    el.type === "pcb_courtyard_polygon" ||
    el.type === "pcb_courtyard_circle"
  )
}

/**
 * Check for overlapping PCB component courtyards (F.CrtYd / B.CrtYd zones).
 * Returns an error for each pair of components whose courtyard regions intersect.
 */
export function checkPcbCourtyardOverlap(
  circuitJson: AnyCircuitElement[],
): PcbCourtyardOverlapError[] {
  const errors: PcbCourtyardOverlapError[] = []

  // Collect all courtyard elements and group by component
  const componentMap = new Map<string, ComponentCourtyard>()

  for (const el of circuitJson) {
    if (!isCourtyardElement(el)) continue

    const componentId =
      el.pcb_component_id ?? `standalone_courtyard_${getPrimaryId(el)}`

    if (!componentMap.has(componentId)) {
      componentMap.set(componentId, {
        component_id: componentId,
        elements: [],
        bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      })
    }
    componentMap.get(componentId)!.elements.push(el)
  }

  // Compute bounding box for each component's courtyard
  for (const data of componentMap.values()) {
    if (data.elements.length > 0) {
      data.bounds = getBoundsOfPcbElements(data.elements as any)
    }
  }

  const components = Array.from(componentMap.values())

  // Pairwise check
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const comp1 = components[i]
      const comp2 = components[j]

      if (!doBoundsOverlap(comp1.bounds, comp2.bounds)) continue

      const name1 = getComponentName(circuitJson, comp1.component_id)
      const name2 = getComponentName(circuitJson, comp2.component_id)

      errors.push({
        type: "pcb_courtyard_overlap_error",
        pcb_error_id: `pcb_courtyard_overlap_${comp1.component_id}_${comp2.component_id}`,
        error_type: "pcb_courtyard_overlap_error",
        message: `courtyard of ${name1} overlaps with courtyard of ${name2}`,
        pcb_component_ids: [comp1.component_id, comp2.component_id],
      })
    }
  }

  return errors
}
