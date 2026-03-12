import { getBoundsOfPcbElements } from "@tscircuit/circuit-json-util"
import { doBoundsOverlap } from "@tscircuit/math-utils"
import type { PcbHole, PcbPlatedHole, PcbSmtPad } from "circuit-json"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"

export type OverlappableElement = PcbSmtPad | PcbPlatedHole | PcbHole

function getElementLayers(elem: OverlappableElement): string[] {
  return getLayersOfPcbElement(elem as any)
}

function doLayersOverlap(
  layers1: string[],
  layers2: string[],
): boolean {
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

  const bounds1 = getBoundsOfPcbElements([elem1])
  const bounds2 = getBoundsOfPcbElements([elem2])
  return doBoundsOverlap(bounds1, bounds2)
}
