# Pin-specification warning consolidation

Missing pin attributes, missing power roles, and missing ground roles are combined only for the same component and subcircuit. Partially specified components retain only the applicable reasons. Connectivity errors remain separate. The fixture shows three warnings becoming one summary.

`runAllPinSpecificationChecks` enables this by default, so `runAllChecks` also returns summaries.
Call `runAllPinSpecificationChecks(circuitJson, { consolidatePinWarnings: false })` for the original entries, or call the individual checks directly.
The exported `consolidatePinSpecificationWarnings(circuitJson, warnings)` helper can also be applied to combined diagnostic lists.

Summaries retain an existing Circuit JSON warning type. The exported `ConsolidatedPinSpecificationWarning` type adds `related_warnings` containing every original diagnostic. It also retains the union of `source_port_ids` for navigation. Singletons are returned unchanged; applying consolidation twice is safe and inputs are not mutated. Fatal and nonfatal records are never combined.

The singular component ID identifies the representative warning; consumers that want to highlight every affected location should use the plural IDs or `related_warnings`. These are checks-specific extension fields, like the existing overlap consolidator's `related_errors`, and are not declared in the upstream Circuit JSON schema. Consumers that strip unknown fields must request raw output or preserve the extensions. A console can print the summary immediately, but expandable UI requires consumer support. Count original findings through `related_warnings?.length ?? 1`, rather than treating the returned array length as the original finding count.

![Before and after warning messages](../tests/lib/__snapshots__/consolidate-pin-specification-warnings.snap.svg)

The snapshot is generated from actual check output, not hand-written example messages. Regenerate with:

```sh
BUN_UPDATE_SNAPSHOTS=1 bun test tests/lib/consolidate-pin-specification-warnings.test.ts
```
