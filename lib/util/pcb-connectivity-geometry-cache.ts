import { Utils, type Polygon } from "@flatten-js/core"

type CachedGeometryState = {
  polygons: Map<string, Polygon>
  hits: number
  misses: number
}

export interface PcbConnectivityGeometryCacheStats {
  hits: number
  misses: number
  entries: number
}

const MAX_CACHED_COPPER_POLYGONS = 32768
const geometryByCache = new WeakMap<
  PcbConnectivityGeometryCache,
  CachedGeometryState
>()

/** Opt-in, bounded geometry reuse between physical connectivity evaluations. */
export class PcbConnectivityGeometryCache {
  constructor() {
    geometryByCache.set(this, {
      polygons: new Map<string, Polygon>(),
      hits: 0,
      misses: 0,
    })
  }

  clear(): void {
    const state = geometryByCache.get(this)!
    state.polygons.clear()
    state.hits = 0
    state.misses = 0
  }

  getStats(): PcbConnectivityGeometryCacheStats {
    const state = geometryByCache.get(this)!
    return {
      hits: state.hits,
      misses: state.misses,
      entries: state.polygons.size,
    }
  }
}

/** Accessor/non-finite geometry keeps the original live construction path. */
export function getCopperPolygonGeometryKey(
  kind: "wire" | "via",
  properties: ReadonlyArray<readonly [object, string]>,
): string | undefined {
  // Flatten uses its live tolerance while constructing and orienting arcs.
  const tolerance = Utils.getTolerance()
  if (!Number.isFinite(tolerance)) return undefined
  const values: string[] = [
    kind,
    Object.is(tolerance, -0) ? "-0" : String(tolerance),
  ]
  for (const [object, property] of properties) {
    const descriptor = Object.getOwnPropertyDescriptor(object, property)
    if (
      !descriptor ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "number" ||
      !Number.isFinite(descriptor.value)
    ) {
      return undefined
    }
    values.push(
      Object.is(descriptor.value, -0) ? "-0" : String(descriptor.value),
    )
  }
  return values.join(":")
}

/** Internally owned polygons stay hidden from cache callers and input objects. */
export function getCachedScaledCopperPolygon(
  cache: PcbConnectivityGeometryCache,
  geometryKey: string,
  scale: number,
  createPolygon: () => Polygon,
): Polygon {
  const state = geometryByCache.get(cache)!
  const key = `${scale}:${geometryKey}`
  const cached = state.polygons.get(key)
  if (cached) {
    state.hits += 1
    return cached
  }
  state.misses += 1
  const polygon = createPolygon()
  const scaled = polygon.isEmpty() ? polygon : polygon.scale(scale, scale)
  if (state.polygons.size >= MAX_CACHED_COPPER_POLYGONS) {
    const oldestKey = state.polygons.keys().next().value!
    state.polygons.delete(oldestKey)
  }
  state.polygons.set(key, scaled)
  return scaled
}
