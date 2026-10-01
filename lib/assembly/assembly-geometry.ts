import type { PlatformConfig } from "@tscircuit/props"
import type { CadComponent, CadEnclosure, PcbComponent } from "circuit-json"
export type CadComponentId = CadComponent["cad_component_id"]
export type PcbComponentId = PcbComponent["pcb_component_id"]
export type EnclosureApertureFace = CadEnclosure["apertures"][number]["face"]
/** Indexed outward CCW triangles in the right-handed world frame: +X right,
 * +Y top, +Z above, mm. Translation, origin, scale and layer pose are baked in.
 */
export interface CadMesh {
  positions: readonly number[] | Float32Array | Float64Array
  indices: readonly number[] | Uint32Array
}
/** Optional platform services. Geometry and associations come from Circuit JSON. */
export interface CheckOptions {
  platformConfig?: Pick<PlatformConfig, "localCacheEngine" | "projectBaseUrl">
  intersectionAreaThresholdMm2?: number
}
