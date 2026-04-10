import type { AnyCircuitElement } from "circuit-json"

export type PcbPlacementLayer = "top" | "bottom"

function normalizePlacementLayer(
  layer: string | null | undefined,
): PcbPlacementLayer | null {
  if (layer === "top" || layer === "bottom") return layer
  return null
}

export function getPcbComponentPlacementLayerMap(
  circuitJson: AnyCircuitElement[],
): Map<string, PcbPlacementLayer> {
  const componentLayerMap = new Map<string, PcbPlacementLayer>()

  for (const element of circuitJson) {
    if (element.type !== "pcb_component") continue

    const placementLayer = normalizePlacementLayer(element.layer)
    if (!placementLayer) continue

    componentLayerMap.set(element.pcb_component_id, placementLayer)
  }

  return componentLayerMap
}

export function getElementPlacementLayer(
  element: {
    pcb_component_id?: string
    layer?: string
    layers?: string[]
  },
  componentLayerMap?: ReadonlyMap<string, PcbPlacementLayer>,
): PcbPlacementLayer | null {
  const componentPlacementLayer = element.pcb_component_id
    ? (componentLayerMap?.get(element.pcb_component_id) ?? null)
    : null
  if (componentPlacementLayer) return componentPlacementLayer

  const singleLayerPlacement = normalizePlacementLayer(element.layer)
  if (singleLayerPlacement) return singleLayerPlacement

  const hasTop = element.layers?.includes("top") ?? false
  const hasBottom = element.layers?.includes("bottom") ?? false

  if (hasTop === hasBottom) return null
  return hasTop ? "top" : "bottom"
}

export function arePlacementLayersSeparated(
  layerA: PcbPlacementLayer | null,
  layerB: PcbPlacementLayer | null,
): boolean {
  return layerA !== null && layerB !== null && layerA !== layerB
}

export function getPlacementLayersFromLayerNames(
  layerNames: readonly string[] | null | undefined,
): PcbPlacementLayer[] {
  const placementLayers: PcbPlacementLayer[] = []

  if (layerNames?.includes("top")) placementLayers.push("top")
  if (layerNames?.includes("bottom")) placementLayers.push("bottom")

  return placementLayers
}

export function arePlacementLayerSetsSeparated(
  layersA: readonly PcbPlacementLayer[],
  layersB: readonly PcbPlacementLayer[],
): boolean {
  return (
    layersA.length > 0 &&
    layersB.length > 0 &&
    !layersA.some((layer) => layersB.includes(layer))
  )
}
