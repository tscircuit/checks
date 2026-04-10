import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbCourtyardOverlapError } from "circuit-json"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"
import { runAllPlacementChecks } from "lib/run-all-checks"
import usbAudioDevice from "tests/assets/usb-audio-device.json"

interface Point {
  x: number
  y: number
}

interface PcbComponentRef {
  pcb_component_id: string
  source_component_id: string
}

interface PcbCourtyardRectRef {
  pcb_component_id: string
  center: Point
  width: number
  height: number
}

interface PcbCourtyardOutlineRef {
  pcb_component_id: string
  outline: Point[]
}

const getSourceComponentIdByName = (
  circuitJson: AnyCircuitElement[],
  name: string,
): string => {
  const component = circuitJson.find(
    (element): element is AnyCircuitElement & { source_component_id: string } =>
      element.type === "source_component" && element.name === name,
  )

  if (!component) {
    throw new Error(`Missing source component ${name}`)
  }

  return component.source_component_id
}

const getPcbComponentIdBySourceComponentId = (
  circuitJson: AnyCircuitElement[],
  sourceComponentId: string,
): string => {
  const pcbComponent = circuitJson.find(
    (element): element is AnyCircuitElement & PcbComponentRef =>
      element.type === "pcb_component" &&
      element.source_component_id === sourceComponentId,
  )

  if (!pcbComponent) {
    throw new Error(`Missing pcb component for ${sourceComponentId}`)
  }

  return pcbComponent.pcb_component_id
}

const getCourtyardRectByComponentId = (
  circuitJson: AnyCircuitElement[],
  pcbComponentId: string,
): PcbCourtyardRectRef => {
  const courtyard = circuitJson.find(
    (element): element is AnyCircuitElement & PcbCourtyardRectRef =>
      element.type === "pcb_courtyard_rect" &&
      element.pcb_component_id === pcbComponentId,
  )

  if (!courtyard) {
    throw new Error(`Missing courtyard rect for ${pcbComponentId}`)
  }

  return courtyard
}

const getCourtyardOutlineByComponentId = (
  circuitJson: AnyCircuitElement[],
  pcbComponentId: string,
): PcbCourtyardOutlineRef => {
  const courtyard = circuitJson.find(
    (element): element is AnyCircuitElement & PcbCourtyardOutlineRef =>
      element.type === "pcb_courtyard_outline" &&
      element.pcb_component_id === pcbComponentId,
  )

  if (!courtyard) {
    throw new Error(`Missing courtyard outline for ${pcbComponentId}`)
  }

  return courtyard
}

const getRectCorners = ({ center, width, height }: PcbCourtyardRectRef) => {
  const halfWidth = width / 2
  const halfHeight = height / 2

  return [
    { x: center.x - halfWidth, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y + halfHeight },
    { x: center.x - halfWidth, y: center.y + halfHeight },
  ]
}

const pointIsOnSegment = (point: Point, a: Point, b: Point) => {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y)
  if (Math.abs(cross) > 1e-9) return false

  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)
  if (dot < 0) return false

  const squaredLength = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
  return dot <= squaredLength
}

const pointIsInsidePolygon = (point: Point, polygon: Point[]) => {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]

    if (pointIsOnSegment(point, a, b)) return true

    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x

    if (intersects) inside = !inside
  }

  return inside
}

const isBetweenComponents = (
  error: PcbCourtyardOverlapError,
  componentAId: string,
  componentBId: string,
) => {
  return (
    error.pcb_component_ids.includes(componentAId) &&
    error.pcb_component_ids.includes(componentBId)
  )
}

test("usb audio device reports C7 inside Y1 as a courtyard overlap", async () => {
  const circuitJson = usbAudioDevice as AnyCircuitElement[]

  const y1SourceComponentId = getSourceComponentIdByName(circuitJson, "Y1")
  const c7SourceComponentId = getSourceComponentIdByName(circuitJson, "C7")

  const y1PcbComponentId = getPcbComponentIdBySourceComponentId(
    circuitJson,
    y1SourceComponentId,
  )
  const c7PcbComponentId = getPcbComponentIdBySourceComponentId(
    circuitJson,
    c7SourceComponentId,
  )

  const y1Courtyard = getCourtyardOutlineByComponentId(
    circuitJson,
    y1PcbComponentId,
  )
  const c7Courtyard = getCourtyardRectByComponentId(
    circuitJson,
    c7PcbComponentId,
  )

  for (const corner of getRectCorners(c7Courtyard)) {
    expect(pointIsInsidePolygon(corner, y1Courtyard.outline)).toBe(true)
  }

  const courtyardErrors = checkCourtyardOverlap(circuitJson)
  const c7InsideY1Error = courtyardErrors.find((error) =>
    isBetweenComponents(error, c7PcbComponentId, y1PcbComponentId),
  )

  expect(c7InsideY1Error).toBeDefined()
  expect(c7InsideY1Error?.message).toBe(
    "Courtyard of C7 overlaps with courtyard of Y1",
  )

  const placementErrors = await runAllPlacementChecks(circuitJson)
  const placementCourtyardError = placementErrors.find(
    (error) =>
      error.type === "pcb_courtyard_overlap_error" &&
      isBetweenComponents(error, c7PcbComponentId, y1PcbComponentId),
  )

  expect(placementCourtyardError).toBeDefined()
  expect(placementCourtyardError?.message).toBe(
    "Courtyard of C7 overlaps with courtyard of Y1",
  )
})
