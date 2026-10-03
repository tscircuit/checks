# Explicit bus routing constraints

`checkPcbRoutingConstraints(circuitJson)` checks declared `source_bus.routing_constraints` and `max_length_skew`. It also runs through `runAllRoutingChecks`. No device names, protocol roles, vendor profiles, or electrical limits are inferred.

```tsx
<bus name="DATA_AND_STROBE" routingDisabled
  connections={[...dataSignals, ...strobeSignals]}
  maxLengthSkew="25mil" />
<bus name="DATA" routingDisabled connections={dataSignals}
  pcbRoutingConstraints={{
    expectedTraceCount: 9,
    lengthBounds: {
      referenceBus: "DATA_AND_STROBE",
      referenceMetric: "longest_manhattan",
      max: 0,
    },
    spacing: [{
      otherBus: "DATA",
      centerlineWidthMultiplier: 3,
      reducedCenterlineWidthMultiplier: 1,
    }, {
      otherBus: "COMMANDS",
      centerlineWidthMultiplier: 4,
      reducedCenterlineWidthMultiplier: 1,
    }],
    maxReducedSpacingLength: "1250mil",
    impedanceBounds: { min: "50ohm", max: "75ohm" },
  }} />
```

Values in this illustration are supplied by the design, not the checker. Authors must extract their requirements from the appropriate component specifications. `<differentialpair>` accepts the same constraints and its existing `maxLengthSkew`, impedance target, gap and polarity props. Check-only buses (`routingDisabled`) preserve source membership without creating extra routing groups. Overlapping memberships intentionally compose checks.

## Semantics

- `expectedTraceCount`: count of distinct members.
- `maxLengthSkew`: difference between longest and shortest planar routes in that group. A group containing data and strobe signals expresses cross-group matching without semantic signal roles.
- `lengthBounds.min/max`: absolute mm without a reference; offsets in mm with both `referenceBus` and `referenceMetric`. The `longest_manhattan` metric is the longest pad-to-pad Manhattan distance of the reference group's members. For nominal length equal to that distance plus 300 mil with a 50 mil tolerance, declare `min: "250mil", max: "350mil"`.
- `spacing`: directed checks against the named bus, on common layers. The multiplier uses the larger local trace width. Self comparisons and explicitly declared pair-internal comparisons are skipped. Add the reverse rule when both groups require checks. Reduced-spacing intervals are unioned across all neighbours and rules before comparison to the bus's shared `maxReducedSpacingLength` cap.
- `impedanceBounds`: acceptable declared target impedance, in ohms. Differential targets are checked directly against differential bounds; no single-ended conversion is assumed. A missing target is unverified. Physical impedance is unverified even when the declared target is within bounds.

Bus references resolve by exact name within the same subcircuit. Missing or ambiguous references produce unverified findings. Negative relative offsets are allowed; absolute bounds must be nonnegative. Bounds must be ordered. Reduced spacing requires an explicit shared length cap. No defaults or aliases supply missing engineering decisions.

Geometry is measured from connected pad-to-pad routes, including planar fanout fragments joined by explicit vias. Cached route lengths are ignored. Missing, branched, disconnected or unsupported geometry remains unverified. Measurements use board-world XY in mm (+X right, +Y up); via barrel depth and electrical flight time are not inferred.

Results use `pcb_routing_constraint_error`, with `status: "violation" | "unverified"`, rule names, readable messages and structured bus/trace references. A clean result establishes only the declared checks. Actual stackup impedance, reference-plane continuity, power/termination circuits, decoupling, placement restrictions, branch topology and signal integrity require separate validation; this checker does not certify an interface.

This replaces the unmerged profile-based API. Use explicit numeric constraints and compositional bus membership instead of `pcbDdrRouting`; the old profile and DDR-specific error type are removed.
