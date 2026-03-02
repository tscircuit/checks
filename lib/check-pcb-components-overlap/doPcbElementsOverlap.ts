import { getBoundsOfPcbElements } from "@tscircuit/circuit-json-util"
import { doBoundsOverlap } from "@tscircuit/math-utils"
import type { PcbHole, PcbPlatedHole, PcbSmtPad } from "circuit-json"

export type OverlappableElement = PcbSmtPad | PcbPlatedHole | PcbHole

export function doPcbElementsOverlap(
  elem1: OverlappableElement,
  elem2: OverlappableElement,
): boolean {
  const bounds1 = getBoundsOfPcbElements([elem1])
  const bounds2 = getBoundsOfPcbElements([elem2])
  return doBoundsOverlap(bounds1, bounds2)
}
