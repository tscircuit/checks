# Assembly collision checks

The async checks discover enclosure associations in Circuit JSON and load the
actual CAD geometry themselves. No geometry provider or reconstructed TSX tree
is required:

```ts
const diagnostics = await runAllAssemblyChecks(circuitJson)
// Or include electrical/PCB checks as well:
const allDiagnostics = await runAllChecks(circuitJson)
```

Core exports `cad_enclosure` records containing the finished base/lid CAD IDs,
the aperture-owner PCB IDs, their resolved world-axis faces, and whether the
enclosure is in an assembly. These associations survive JSON serialization.
Ordinary PCB JSON, nonassembly enclosures, and enclosures without apertures return
without loading models or initializing Manifold. Association discovery never
uses component names or guesses that an arbitrary CAD model is an enclosure.

For platform services, pass the existing platform config as an optional input:

```ts
await runAllAssemblyChecks(circuitJson, { platformConfig })
```

`platformConfig.localCacheEngine` supplies the platform's localStorage-compatible
sync or async cache. Posed indexed triangles are stored under
`tscircuit:cad_mesh:v1:<sha256>`. The key includes the full CAD pose/model,
associated PCB record, and `projectBaseUrl`; a placement/model/project change
cannot reuse stale geometry. Concurrent requests share pending loads per cache
engine. Missing/corrupt/unavailable cache entries fall back to real model loading;
cache write failures do not affect the result. Kernel objects and failed loads
are never persisted.

`platformConfig.projectBaseUrl` resolves relative model URLs. Absolute URLs,
data URLs, and authored JSCAD models work with the one-argument API. The shared
`circuit-json-to-gltf` loader applies the renderer's origin, scale, rotation, and
mounting-layer conventions, producing outward-wound triangles in right-handed
Circuit JSON world coordinates (+X right, +Y top, +Z above), in millimetres.
Generated JSCAD T-junctions are subdivided at existing surface vertices; open
models are not repaired by adding caps or substituting convex hulls.

The check unions the finished enclosure parts, intersects each aperture-bearing
part, and projects the intersection along the internally resolved aperture face
normal. It emits `cad_collision_error` strictly above 2 mm² by default
(`intersectionAreaThresholdMm2` can override the threshold; 1e-6 mm² numerical
tolerance). The metric is union silhouette area, not volume, mesh surface area,
a bounding box, or volume divided by a guessed wall thickness. Touching without
penetration does not produce a collision. Unioning base/lid avoids double counting.

Errors contain required `cad_component_ids` and `source_component_ids`, plus
optional `pcb_component_ids`, with deduplicated references to the part and shell
solids. The error has no `face`, singular component references, or separate
enclosure ID property.

Missing/failed/non-manifold models emit `source_runtime_error` diagnostics in
`AssemblyDesignRuleChecks`. Other valid parts continue to be checked. If an
enclosure mesh is unavailable, that enclosure check is incomplete. A static
collision cannot detect an opening misplaced above a recessed connector that
never touches the wall. Cable insertion space and lever travel require separate
authored access/motion envelopes. The visual TSX fixtures cover this limitation
as well as actual side/lid obstruction and placement on both PCB layers.
