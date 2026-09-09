import { getBoundsOfPcbElements } from "@tscircuit/circuit-json-util"
import { doBoundsOverlap } from "@tscircuit/math-utils"
import type {
  PCBKeepout,
  PcbCourtyardCircle,
  PcbCourtyardOutline,
  PcbCourtyardPolygon,
  PcbCourtyardRect,
  PcbHole,
  PcbPlatedHole,
  PcbSmtPad,
} from "circuit-json"
import type { Collidable } from "lib/check-each-pcb-trace-non-overlapping/getCollidableBounds"
import { getRotatedRectPoints } from "lib/check-each-pcb-trace-non-overlapping/segment-to-polygon-clearance"
import { getPadToPadGap } from "lib/check-pad-clearance/common"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"

type CourtyardElement =
  | PcbCourtyardCircle
  | PcbCourtyardOutline
  | PcbCourtyardPolygon
  | PcbCourtyardRect

export type OverlappableElement =
  | PcbSmtPad
  | PcbPlatedHole
  | PcbHole
  | CourtyardElement

const isCourtyardElement = (
  element: OverlappableElement,
): element is CourtyardElement =>
  element.type === "pcb_courtyard_circle" ||
  element.type === "pcb_courtyard_outline" ||
  element.type === "pcb_courtyard_polygon" ||
  element.type === "pcb_courtyard_rect"

const getCourtyardId = (courtyard: CourtyardElement): string => {
  switch (courtyard.type) {
    case "pcb_courtyard_circle":
      return courtyard.pcb_courtyard_circle_id
    case "pcb_courtyard_outline":
      return courtyard.pcb_courtyard_outline_id
    case "pcb_courtyard_polygon":
      return courtyard.pcb_courtyard_polygon_id
    case "pcb_courtyard_rect":
      return courtyard.pcb_courtyard_rect_id
  }
}

/**
 * Reuse the copper-clearance geometry for plated-hole/courtyard checks.
 * Rectangular courtyards become polygons so their rotation is preserved.
 */
const courtyardToKeepout = (courtyard: CourtyardElement): PCBKeepout => {
  const common = {
    type: "pcb_keepout" as const,
    pcb_keepout_id: getCourtyardId(courtyard),
    layers: [courtyard.layer],
  }

  if (courtyard.type === "pcb_courtyard_circle") {
    return {
      ...common,
      shape: "circle",
      center: courtyard.center,
      radius: courtyard.radius,
    }
  }

  const outline =
    courtyard.type === "pcb_courtyard_rect"
      ? getRotatedRectPoints({
          x: courtyard.center.x,
          y: courtyard.center.y,
          width: courtyard.width,
          height: courtyard.height,
          ccwRotation: courtyard.ccw_rotation ?? 0,
        })
      : courtyard.type === "pcb_courtyard_polygon"
        ? courtyard.points
        : courtyard.outline

  return {
    ...common,
    shape: "outline",
    outline,
    stroke_width: 0,
  }
}

function getElementLayers(elem: OverlappableElement): string[] {
  if (isCourtyardElement(elem)) {
    return [elem.layer]
  }

  return getLayersOfPcbElement(elem as Collidable)
}

function doLayersOverlap(layers1: string[], layers2: string[]): boolean {
  if (layers1.length === 0 || layers2.length === 0) return true
  return layers1.some((l) => layers2.includes(l))
}

export function doPcbElementsOverlap(
  elem1: OverlappableElement,
  elem2: OverlappableElement,
): boolean {
  // If the elements are on completely different layers they cannot overlap
  const layers1 = getElementLayers(elem1)
  const layers2 = getElementLayers(elem2)
  if (!doLayersOverlap(layers1, layers2)) return false

  if (elem1.type === "pcb_smtpad" && elem2.type === "pcb_smtpad") {
    return getPadToPadGap(elem1, elem2) <= 0
  }

  if (elem1.type === "pcb_plated_hole" && isCourtyardElement(elem2)) {
    return getPadToPadGap(elem1, courtyardToKeepout(elem2)) <= 0
  }

  if (isCourtyardElement(elem1) && elem2.type === "pcb_plated_hole") {
    return getPadToPadGap(elem2, courtyardToKeepout(elem1)) <= 0
  }

  const bounds1 = getBoundsOfPcbElements([elem1])
  const bounds2 = getBoundsOfPcbElements([elem2])
  return doBoundsOverlap(bounds1, bounds2)
}
