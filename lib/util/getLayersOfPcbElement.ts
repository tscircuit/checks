import { all_layers } from "circuit-json"
import type { Collidable } from "lib/check-each-pcb-trace-non-overlapping/getCollidableBounds"

const getPhysicalLayerStack = (layerCount?: number): string[] => {
  if (layerCount === 1) return ["top"]
  if (layerCount !== undefined && layerCount >= 2) {
    return [
      "top",
      ...Array.from(
        { length: Math.max(0, layerCount - 2) },
        (_, index) => `inner${index + 1}`,
      ),
      "bottom",
    ]
  }

  return [
    "top",
    ...all_layers
      .filter((layer) => /^inner[1-9][0-9]*$/.test(layer))
      .sort(
        (a, b) =>
          Number(a.slice("inner".length)) - Number(b.slice("inner".length)),
      ),
    "bottom",
  ]
}

const expandPlatedLayerSpan = (
  layers: string[],
  layerCount?: number,
): string[] => {
  if (layers.length !== 2) return layers

  const stack = getPhysicalLayerStack(layerCount)
  const firstIndex = stack.indexOf(layers[0]!)
  const secondIndex = stack.indexOf(layers[1]!)
  if (firstIndex === -1 || secondIndex === -1) return layers

  return stack.slice(
    Math.min(firstIndex, secondIndex),
    Math.max(firstIndex, secondIndex) + 1,
  )
}

export function getLayersOfPcbElement(
  obj: Collidable,
  layerCount?: number,
): string[] {
  if (obj.type === "pcb_trace_segment") {
    return [obj.layer]
  }
  if (obj.type === "pcb_smtpad") {
    return [obj.layer]
  }
  if (obj.type === "pcb_plated_hole") {
    return Array.isArray(obj.layers)
      ? expandPlatedLayerSpan(obj.layers, layerCount)
      : [...all_layers]
  }
  if (obj.type === "pcb_hole") {
    return [...all_layers]
  }
  if (obj.type === "pcb_via") {
    return Array.isArray(obj.layers)
      ? expandPlatedLayerSpan(obj.layers, layerCount)
      : [...all_layers]
  }
  if (obj.type === "pcb_keepout") {
    return Array.isArray(obj.layers) ? obj.layers : []
  }
  return []
}
