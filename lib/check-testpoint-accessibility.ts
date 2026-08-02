import { isPointInsidePolygon } from "@tscircuit/math-utils"
import type {
  AnyCircuitElement,
  PcbComponent,
  PcbCourtyardCircle,
  PcbCourtyardOutline,
  PcbCourtyardPolygon,
  PcbCourtyardRect,
  PcbPlacementError,
  SourceSimpleTestPoint,
} from "circuit-json"
import { getReadableNameForComponent } from "./util/get-readable-names"

type CourtyardElement =
  | PcbCourtyardCircle
  | PcbCourtyardOutline
  | PcbCourtyardPolygon
  | PcbCourtyardRect

const isCourtyardElement = (
  element: AnyCircuitElement,
): element is CourtyardElement =>
  element.type === "pcb_courtyard_circle" ||
  element.type === "pcb_courtyard_outline" ||
  element.type === "pcb_courtyard_polygon" ||
  element.type === "pcb_courtyard_rect"

const isPointInsideCourtyard = (
  point: { x: number; y: number },
  courtyard: CourtyardElement,
): boolean => {
  if (courtyard.type === "pcb_courtyard_circle") {
    const dx = point.x - courtyard.center.x
    const dy = point.y - courtyard.center.y
    return dx * dx + dy * dy <= courtyard.radius * courtyard.radius
  }

  if (courtyard.type === "pcb_courtyard_rect") {
    const angle = (-1 * (courtyard.ccw_rotation ?? 0) * Math.PI) / 180
    const dx = point.x - courtyard.center.x
    const dy = point.y - courtyard.center.y
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle)
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle)
    return (
      Math.abs(localX) <= courtyard.width / 2 &&
      Math.abs(localY) <= courtyard.height / 2
    )
  }

  const polygon =
    courtyard.type === "pcb_courtyard_polygon"
      ? courtyard.points
      : courtyard.outline
  return isPointInsidePolygon(point, polygon)
}

const getPcbComponentName = (
  circuitJson: AnyCircuitElement[],
  pcbComponentId: string,
): string => {
  const pcbComponent = circuitJson.find(
    (element): element is PcbComponent =>
      element.type === "pcb_component" &&
      element.pcb_component_id === pcbComponentId,
  )
  const sourceComponent = circuitJson.find(
    (element) =>
      element.type === "source_component" &&
      element.source_component_id === pcbComponent?.source_component_id,
  )

  return (
    (sourceComponent && "name" in sourceComponent
      ? sourceComponent.name
      : undefined) ?? getReadableNameForComponent(circuitJson, pcbComponentId)
  )
}

/**
 * Test points are intended to be contacted from their PCB side. A test point
 * whose access center is covered by another component's courtyard cannot be
 * reliably reached by a probe after assembly.
 */
export function checkTestPointAccessibility(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  const sourceTestPoints = circuitJson.filter(
    (element): element is SourceSimpleTestPoint =>
      element.type === "source_component" &&
      element.ftype === "simple_test_point",
  )
  const sourceTestPointIds = new Set(
    sourceTestPoints.map((testPoint) => testPoint.source_component_id),
  )
  const testPointNames = new Map(
    sourceTestPoints.map((testPoint) => [
      testPoint.source_component_id,
      testPoint.name,
    ]),
  )
  const testPointComponents = circuitJson.filter(
    (element): element is PcbComponent =>
      element.type === "pcb_component" &&
      sourceTestPointIds.has(element.source_component_id),
  )
  const courtyards = circuitJson.filter(isCourtyardElement)
  const errors: PcbPlacementError[] = []
  const reportedComponentPairs = new Set<string>()

  for (const testPoint of testPointComponents) {
    for (const courtyard of courtyards) {
      if (courtyard.pcb_component_id === testPoint.pcb_component_id) continue
      if (courtyard.layer !== testPoint.layer) continue
      if (!isPointInsideCourtyard(testPoint.center, courtyard)) continue

      const componentPair = `${testPoint.pcb_component_id}:${courtyard.pcb_component_id}`
      if (reportedComponentPairs.has(componentPair)) continue
      reportedComponentPairs.add(componentPair)

      const testPointName =
        testPointNames.get(testPoint.source_component_id) ?? "Test point"
      const obstructingComponentName = getPcbComponentName(
        circuitJson,
        courtyard.pcb_component_id,
      )

      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `testpoint_in_courtyard_${testPoint.pcb_component_id}_${courtyard.pcb_component_id}`,
        error_type: "pcb_placement_error",
        message: `Test point ${testPointName} is not accessible because it is inside the courtyard of ${obstructingComponentName}`,
        subcircuit_id: testPoint.subcircuit_id,
      })
    }
  }

  return errors
}
