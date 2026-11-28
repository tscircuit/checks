import { type PcbBoard, type PcbVia, all_layers } from "circuit-json"

const INNER_LAYERS = all_layers.filter((layer) => layer.startsWith("inner"))

export function getViaDrillSpanLayers(via: PcbVia, board?: PcbBoard): string[] {
  const innerCount = board ? Math.max(0, board.num_layers - 2) : undefined
  const layerStack: string[] = [
    "top",
    ...INNER_LAYERS.slice(0, innerCount),
    ...(board?.num_layers === 1 ? [] : ["bottom"]),
  ]

  if (via.through_hole === true) {
    return layerStack
  }

  if (via.topmost_drill_layer && via.bottommost_drill_layer) {
    const topIdx = layerStack.indexOf(via.topmost_drill_layer)
    const bottomIdx = layerStack.indexOf(via.bottommost_drill_layer)
    if (topIdx >= 0 && bottomIdx >= 0) {
      return layerStack.slice(
        Math.min(topIdx, bottomIdx),
        Math.max(topIdx, bottomIdx) + 1,
      )
    }
  }

  const endpointLayers =
    Array.isArray(via.layers) && via.layers.length > 0
      ? via.layers
      : via.from_layer && via.to_layer
        ? [via.from_layer, via.to_layer]
        : undefined

  if (!endpointLayers) {
    return layerStack
  }

  const stackIndices = endpointLayers
    .map((layer) => layerStack.indexOf(layer))
    .filter((index) => index >= 0)

  if (stackIndices.length === 0) {
    return [...endpointLayers]
  }

  const minIdx = Math.min(...stackIndices)
  const maxIdx = Math.max(...stackIndices)
  return layerStack.slice(minIdx, maxIdx + 1)
}
