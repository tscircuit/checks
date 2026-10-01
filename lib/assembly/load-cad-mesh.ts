import type { LocalCacheEngine } from "@tscircuit/props"
import type { AnyCircuitElement, CadComponent } from "circuit-json"
import type { CadMesh, CheckOptions } from "./assembly-geometry"

const pendingByCache = new WeakMap<
  LocalCacheEngine,
  Map<string, Promise<CadMesh>>
>()
function isMesh(
  value: unknown,
): value is { positions: number[]; indices: number[] } {
  if (!value || typeof value !== "object") return false
  const mesh = value as { positions?: unknown; indices?: unknown }
  const positions = mesh.positions
  const indices = mesh.indices
  return (
    Array.isArray(positions) &&
    Array.isArray(indices) &&
    positions.length > 0 &&
    positions.length % 3 === 0 &&
    indices.length > 0 &&
    indices.length % 3 === 0 &&
    positions.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    indices.every(
      (n) => Number.isInteger(n) && n >= 0 && n < positions.length / 3,
    )
  )
}

/** Cache posed world-mm triangles, never kernel objects. All geometry/pose and
 * project URL inputs are hashed, so placement edits cannot reuse an old mesh.
 */
export async function loadCadMesh(
  cad: CadComponent,
  circuitJson: AnyCircuitElement[],
  options: CheckOptions,
): Promise<CadMesh> {
  const pcbComponent = circuitJson.find(
    (element) =>
      element.type === "pcb_component" &&
      element.pcb_component_id === cad.pcb_component_id,
  )
  const projectBaseUrl = options.platformConfig?.projectBaseUrl
  const cache = options.platformConfig?.localCacheEngine
  const load = async (): Promise<CadMesh> => {
    const { loadCadComponentMesh } = await import("circuit-json-to-gltf")
    return loadCadComponentMesh(cad, {
      pcbComponent:
        pcbComponent?.type === "pcb_component" ? pcbComponent : undefined,
      projectBaseUrl,
    })
  }
  if (!cache) return load()
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify({ cad, pcbComponent, projectBaseUrl }),
    ),
  )
  const key = `tscircuit:cad_mesh:v1:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`
  let pending = pendingByCache.get(cache)
  if (!pending) {
    pending = new Map()
    pendingByCache.set(cache, pending)
  }
  const existing = pending.get(key)
  if (existing) return existing
  const loading = (async () => {
    try {
      const serialized = await cache.getItem(key)
      if (serialized) {
        const mesh: unknown = JSON.parse(serialized)
        if (isMesh(mesh)) return mesh
      }
    } catch {
      /* Unavailable/corrupt caches fall back to the actual model. */
    }
    const mesh = await load()
    try {
      await cache.setItem(
        key,
        JSON.stringify({
          positions: Array.from(mesh.positions),
          indices: Array.from(mesh.indices),
        }),
      )
    } catch {
      /* A cache write must not change the DRC result. */
    }
    return mesh
  })()
  pending.set(key, loading)
  try {
    return await loading
  } finally {
    pending.delete(key)
  }
}
