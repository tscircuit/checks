import { getBoundsOfPcbElements } from "@tscircuit/circuit-json-util"
import { doBoundsOverlap } from "@tscircuit/math-utils"
import type { PcbHole, PcbPlatedHole, PcbSmtPad } from "circuit-json"
import type { Collidable } from "lib/check-each-pcb-trace-non-overlapping/getCollidableBounds"
import {
  courtyardToKeepout,
  type CourtyardElement,
} from "lib/util/courtyard-to-keepout"
import { getPadToPadGap } from "lib/check-pad-clearance/common"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"

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
