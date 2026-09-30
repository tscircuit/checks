import { loadCadMesh } from "./load-cad-mesh"
import type { Manifold, ManifoldToplevel } from "@tscircuit/manifold-2d"
import type {
  AnyCircuitElement,
  CadComponent,
  CadEnclosure,
  CadCollisionError,
  SourceRuntimeError,
} from "circuit-json"
import type {
  CheckOptions,
  CadComponentId,
  CadMesh,
  EnclosureApertureFace,
} from "./assembly-geometry"

export const DEFAULT_ENCLOSURE_INTERSECTION_AREA_THRESHOLD_MM2 = 2

function meshToManifold(kernel: ManifoldToplevel, mesh: CadMesh): Manifold {
  if (
    mesh.positions.length === 0 ||
    mesh.positions.length % 3 !== 0 ||
    mesh.indices.length === 0 ||
    mesh.indices.length % 3 !== 0
  ) {
    throw new Error("Expected nonempty indexed XYZ triangles")
  }
  const vertexCount = mesh.positions.length / 3
  if (
    Array.from(mesh.positions).some((value) => !Number.isFinite(value)) ||
    Array.from(mesh.indices).some(
      (index) => !Number.isInteger(index) || index < 0 || index >= vertexCount,
    )
  ) {
    throw new Error("Mesh contains invalid positions or triangle indices")
  }
  const manifoldMesh = new kernel.Mesh({
    numProp: 3,
    vertProperties: Float32Array.from(mesh.positions),
    triVerts: Uint32Array.from(mesh.indices),
  })
  // CAD triangle soups commonly repeat vertices at face/material boundaries.
  // Weld coincident positions, but do not fill holes or substitute a convex hull.
  manifoldMesh.merge()
  const solid = kernel.Manifold.ofMesh(manifoldMesh)
  if (solid.isEmpty() || solid.volume() <= 0) {
    solid.delete()
    throw new Error("Model does not describe a nonempty outward-oriented solid")
  }
  return solid
}

/** Union silhouette of the actual intersection projected onto the face plane.
 * Manifold.project() projects onto XY, so rotate X/Y normals to Z first.
 * Sign is irrelevant to area; rotations are proper, with no axis reflection.
 * This is not mesh surface area or volume divided by a guessed wall thickness.
 */
function projectedIntersectionArea(
  intersection: Manifold,
  face: EnclosureApertureFace,
): number {
  const oriented = face.startsWith("x_")
    ? intersection.rotate([0, 90, 0])
    : face.startsWith("y_")
      ? intersection.rotate([90, 0, 0])
      : intersection
  try {
    const silhouette = oriented.project()
    try {
      return silhouette.area()
    } finally {
      silhouette.delete()
    }
  } finally {
    if (oriented !== intersection) oriented.delete()
  }
}

/** Async mechanical DRC for serialized assembly enclosure records. It compares
 * real aperture-bearing CAD against the union of finished enclosure parts, in
 * world mm. Intersection can indicate a misplaced aperture or inadequate body
 * clearance. Static meshes cannot establish cable/lever motion clearance.
 */
export async function checkEnclosureApertureIntersections(
  circuitJson: AnyCircuitElement[],
  options: CheckOptions = {},
): Promise<(CadCollisionError | SourceRuntimeError)[]> {
  const enclosures = circuitJson.filter(
    (element): element is CadEnclosure =>
      element.type === "cad_enclosure" &&
      element.is_in_assembly &&
      element.apertures.length > 0,
  )
  if (!enclosures.length) return []
  const threshold =
    options.intersectionAreaThresholdMm2 ??
    DEFAULT_ENCLOSURE_INTERSECTION_AREA_THRESHOLD_MM2
  if (!Number.isFinite(threshold) || threshold < 0)
    throw new Error(
      "intersectionAreaThresholdMm2 must be finite and nonnegative",
    )
  // Same singleton and embedded WASM runtime used by copper-pour geometry.
  // Import and initialize only for an assembly with actual aperture checks.
  const { getManifoldModule } = await import("@tscircuit/manifold-2d")
  const kernel = await getManifoldModule()
  const cadComponents = circuitJson.filter(
    (element): element is CadComponent => element.type === "cad_component",
  )
  const solids = new Map<CadComponentId, Promise<Manifold | null>>()
  const allocatedSolids: Manifold[] = []
  const diagnostics: (CadCollisionError | SourceRuntimeError)[] = []
  const sourceNames = new Map(
    circuitJson
      .filter((element) => element.type === "source_component")
      .map((element) => [element.source_component_id, element.name]),
  )
  const reportIncomplete = (cadId: CadComponentId, cause: unknown) => {
    diagnostics.push({
      type: "source_runtime_error",
      error_type: "source_runtime_error",
      source_runtime_error_id: `source_runtime_error_enclosure_geometry_${cadId}`,
      phase_name: "AssemblyDesignRuleChecks",
      message: `Enclosure aperture DRC could not check ${cadId}: ${cause instanceof Error ? cause.message : String(cause)}`,
    })
  }
  const getSolid = (cadId: CadComponentId): Promise<Manifold | null> => {
    let pending = solids.get(cadId)
    if (!pending) {
      pending = (async () => {
        try {
          const cad = cadComponents.find(
            (cad) => cad.cad_component_id === cadId,
          )
          if (!cad) throw new Error("CAD reference not found")
          const solid = meshToManifold(
            kernel,
            await loadCadMesh(cad, circuitJson, options),
          )
          allocatedSolids.push(solid)
          return solid
        } catch (error) {
          reportIncomplete(cadId, error)
          return null
        }
      })()
      solids.set(cadId, pending)
    }
    return pending
  }
  try {
    for (const enclosure of enclosures) {
      if (!enclosure.apertures.length || !enclosure.cad_component_ids.length)
        continue
      const enclosureParts = await Promise.all(
        enclosure.cad_component_ids.map(getSolid),
      )
      // An incomplete shell must not produce a misleading partial clear result.
      if (enclosureParts.some((solid) => solid === null)) continue
      const enclosureSolid = kernel.Manifold.union(enclosureParts as Manifold[])
      try {
        const visited = new Set<string>()
        for (const aperture of enclosure.apertures) {
          const candidates = cadComponents.filter(
            (cad) =>
              cad.pcb_component_id === aperture.pcb_component_id &&
              !enclosure.cad_component_ids.includes(cad.cad_component_id),
          )
          if (!candidates.length)
            reportIncomplete(
              aperture.pcb_component_id,
              "Aperture owner has no CAD model",
            )
          for (const cad of candidates) {
            const key = `${cad.cad_component_id}:${aperture.face}`
            if (visited.has(key)) continue
            visited.add(key)
            const partSolid = await getSolid(cad.cad_component_id)
            if (!partSolid) continue
            const intersection = partSolid.intersect(enclosureSolid)
            try {
              if (intersection.isEmpty()) continue
              const area = projectedIntersectionArea(
                intersection,
                aperture.face,
              )
              // A tiny numerical tolerance preserves strict > at the threshold.
              if (area <= threshold + 1e-6) continue
              const name =
                sourceNames.get(cad.source_component_id) ?? cad.cad_component_id
              const collisionCadComponents = [
                cad,
                ...cadComponents.filter((enclosureCad) =>
                  enclosure.cad_component_ids.includes(
                    enclosureCad.cad_component_id,
                  ),
                ),
              ]
              const pcbComponentIds = [
                ...new Set(
                  collisionCadComponents.flatMap((collisionCad) =>
                    collisionCad.pcb_component_id
                      ? [collisionCad.pcb_component_id]
                      : [],
                  ),
                ),
              ]
              diagnostics.push({
                type: "cad_collision_error",
                error_type: "cad_collision_error",
                cad_collision_error_id: `cad_collision_error_${enclosure.cad_component_ids.join("_")}_${cad.cad_component_id}_${aperture.face}`,
                cad_component_ids: [
                  ...new Set(
                    collisionCadComponents.map(
                      (collisionCad) => collisionCad.cad_component_id,
                    ),
                  ),
                ],
                ...(pcbComponentIds.length
                  ? { pcb_component_ids: pcbComponentIds }
                  : {}),
                source_component_ids: [
                  ...new Set(
                    collisionCadComponents.map(
                      (collisionCad) => collisionCad.source_component_id,
                    ),
                  ),
                ],
                intersection_area_mm2: area,
                threshold_area_mm2: threshold,
                message: `${name} intersects the enclosure by ${area.toFixed(2)} mm² projected along ${aperture.face} (threshold ${threshold} mm²). Check the aperture position, size, direction and body clearance.`,
              })
            } finally {
              intersection.delete()
            }
          }
        }
      } finally {
        enclosureSolid.delete()
      }
    }
    return diagnostics
  } finally {
    for (const solid of allocatedSolids) solid.delete()
  }
}
