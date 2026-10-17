import type { PcbVia } from "circuit-json"

const getLayerDepth = (layer: PcbVia["layers"][number]): number =>
  layer === "top" ? 0 : layer === "bottom" ? Infinity : Number(layer.slice(5))

/** Blind/buried holes on disjoint laminations do not share a drilled volume. */
export function doViaDrillSpansOverlap(
  first: Pick<PcbVia, "layers">,
  second: Pick<PcbVia, "layers">,
): boolean {
  const firstDepths = first.layers.map(getLayerDepth)
  const secondDepths = second.layers.map(getLayerDepth)
  return (
    Math.min(...firstDepths) <= Math.max(...secondDepths) &&
    Math.min(...secondDepths) <= Math.max(...firstDepths)
  )
}
