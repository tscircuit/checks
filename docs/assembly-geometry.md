# Assembly geometry checks

`runAllAssemblyChecks(circuitJson, options)` is async. `runAllChecks` accepts the
same optional geometry context. With no context, empty enclosures, or no authored
apertures, the assembly check returns immediately without loading models or
initializing the Manifold kernel.

```ts
const diagnostics = await runAllAssemblyChecks(circuitJson, {
  assemblyGeometry: {
    enclosures: [{
      cadComponentIds: [baseCadId, lidCadId],
      apertures: [{ pcbComponentId: usbPcbId, face: "y_pos" }],
    }],
    getCadComponentMesh: async (cadComponent) =>
      loadCadComponentMesh(cadComponent, { pcbComponent, projectBaseUrl }),
  },
  intersectionAreaThresholdMm2: 2,
})
```

The loader is supplied by the host; checks does not fetch URLs or depend on a
renderer. Each returned `CadMesh` contains flattened XYZ `positions` and indexed
triangle `indices`, as number arrays or typed arrays. Positions are points in
the right-handed Circuit JSON world frame: +X right, +Y top, +Z above, in mm.
Origins, scale, rotation, translation, and mounting-layer orientation must
already be applied. Triangle winding must describe an outward-oriented closed
solid. Every CAD ID is loaded at most once in a pass.

The base and lid are unioned, then intersected with each aperture-bearing part.
The intersection is projected orthographically along the resolved aperture face
normal. The `cad_collision_error` measures the union silhouette area in mm². It
does not use volume (mm³), total mesh surface area, a bounding box, or a guessed
wall thickness. Touching without penetration and areas at or below the threshold
do not emit a collision error.

Only explicit enclosure/aperture associations are checked. Unrelated components
and unrelated assemblies are excluded. The enclosure meshes must represent the
finished parts after cutouts. The six supported faces are `x_pos`, `x_neg`,
`y_pos`, `y_neg`, `z_pos`, and `z_neg` in world coordinates.

Collision errors can indicate aperture misplacement, size/direction problems, or
body clearance problems. This is a static collision heuristic: a connector completely
inside the cavity can have a poorly aligned external opening without its solid
intersecting the wall. Cable insertion space and moving lever travel require
separate authored access envelopes.

A failed/missing model, invalid mesh, or missing CAD reference emits a
`source_runtime_error` in `AssemblyDesignRuleChecks`. Other valid parts continue
to be checked. If an enclosure part is unavailable, its whole enclosure check is
incomplete. Open meshes are not silently repaired with a convex hull or replaced
by a bounding box. The same lazy `@tscircuit/manifold-2d` runtime as copper pours
provides the 3D boolean and projection kernel; all per-pass solids are disposed.
