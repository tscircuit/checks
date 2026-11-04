# Reference-designator warning consolidation

Missing reference designators are grouped by schematic sheet and subcircuit. Other styling rules remain separate. The MSPM0G3507 fixture reproduces 28 warnings becoming one summary.

`runAllSchematicChecks` enables this by default, so `runAllChecks` also returns summaries.
Call `runAllSchematicChecks(circuitJson, { consolidateReferenceDesignators: false })` for the original entries, or call the individual checks directly.
The exported `consolidateReferenceDesignatorWarnings(circuitJson, warnings)` helper can also be applied to combined diagnostic lists.

Summaries retain an existing Circuit JSON warning type. The exported `ConsolidatedReferenceDesignatorWarning` type adds `related_warnings` containing every original diagnostic. It also retains `schematic_component_ids` and `source_component_ids` for navigation. Singletons are returned unchanged; applying consolidation twice is safe and inputs are not mutated. Fatal and nonfatal records are never combined.

The singular component ID identifies the representative warning; consumers that want to highlight every affected location should use the plural IDs or `related_warnings`. These are checks-specific extension fields, like the existing overlap consolidator's `related_errors`, and are not declared in the upstream Circuit JSON schema. Consumers that strip unknown fields must request raw output or preserve the extensions. A console can print the summary immediately, but expandable UI requires consumer support. Count original findings through `related_warnings?.length ?? 1`, rather than treating the returned array length as the original finding count.

![Before and after warning messages](../tests/lib/__snapshots__/consolidate-reference-designator-warnings.snap.svg)

The snapshot is generated from actual check output, not hand-written example messages. Regenerate with:

```sh
BUN_UPDATE_SNAPSHOTS=1 bun test tests/lib/consolidate-reference-designator-warnings.test.ts
```

Fixture provenance: source/schematic component records reduced from release 1.4.2 of [ShiboSoftwareDev/mspm0g3507-usb-c-dev-board](https://tscircuit.com/ShiboSoftwareDev/mspm0g3507-usb-c-dev-board), built locally on 2026-09-10. Only the 28 affected components are retained; routing and unrelated geometry are omitted. This is a diagnostic fixture, not a complete board or routing validation.
