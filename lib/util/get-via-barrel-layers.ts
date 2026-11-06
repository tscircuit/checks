import type { PcbVia } from "circuit-json"
import { getLayersOfPcbElement } from "./getLayersOfPcbElement"

/**
 * The board layers a via's plated barrel passes through. A drill cannot skip a
 * layer, so a record listing only top and bottom on a 4-layer board still
 * reaches both inner layers. Contiguous blind and buried spans are unchanged.
 */
export function getViaBarrelLayers(
  via: PcbVia,
  boardLayerStack: string[],
): string[] {
  const layers = getLayersOfPcbElement(via)
  const stackIndexes = layers.map((layer) => boardLayerStack.indexOf(layer))
  // A layer outside the stack has no known position relative to the others.
  if (stackIndexes.includes(-1)) return layers
  return boardLayerStack.slice(
    Math.min(...stackIndexes),
    Math.max(...stackIndexes) + 1,
  )
}
