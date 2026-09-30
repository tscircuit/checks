import type {
  CadComponent,
  CadCollisionError,
  PcbComponent,
} from "circuit-json"

export type CadComponentId = CadComponent["cad_component_id"]
export type PcbComponentId = PcbComponent["pcb_component_id"]
export type EnclosureApertureFace = CadCollisionError["face"]

/** Indexed triangles in the right-handed Circuit JSON world frame: +X right,
 * +Y top, +Z above, millimetres. Positions are XYZ points, including translation.
 * Each consecutive triple of indices winds CCW as viewed from outside a solid.
 * Model origins, scale, rotation and layer flips must already be baked in.
 * Consumers need no Three.js/JSCAD/Manifold objects or model URL conventions.
 */
export interface CadMesh {
  positions: readonly number[] | Float32Array | Float64Array
  indices: readonly number[] | Uint32Array
}

/** The generated enclosure parts belong to one physical assembly, and only
 * parts with an authored aperture participate. Faces refer to world XYZ axes.
 */
export interface AssemblyEnclosureGeometry {
  cadComponentIds: CadComponentId[]
  apertures: { pcbComponentId: PcbComponentId; face: EnclosureApertureFace }[]
}

export interface AssemblyGeometry {
  enclosures: AssemblyEnclosureGeometry[]
  /** Called at most once per CAD ID in a check pass. A rejection/missing/invalid
   * mesh produces an explicit incomplete-check diagnostic, never a clear result.
   */
  getCadComponentMesh: (cadComponent: CadComponent) => Promise<CadMesh>
}

export interface AssemblyCheckOptions {
  /** Omitted on ordinary PCB checks. No models or kernel are loaded then. */
  assemblyGeometry?: AssemblyGeometry
  /** Emit a collision error strictly above this projected intersection area (mm²), default 2. */
  intersectionAreaThresholdMm2?: number
}
