# Explicit bus routing constraints

`checkPcbRoutingConstraints(circuitJson)` checks constraints stored directly on `source_bus`. It also runs through `runAllRoutingChecks`. No device names, protocol roles, vendor profiles, or electrical limits are inferred.

```tsx
<bus name="DATA" connections={dataSignals}
  lengthMatchTo=".STROBE"
  maxLengthSkew="25mil"
  maxLength={{ reference: "longest_manhattan" }}
  pcbTraceSpacing="3w"
  pcbSpacingToOtherSignals="4w"
  targetImpedanceMin="50ohm"
  targetImpedanceMax="75ohm" />
<differentialpair name="STROBE"
  positiveConnection=".CPU .DQS .RAM .DQS"
  negativeConnection=".CPU .DQSn .RAM .DQSn"
  maxLengthSkew="5mil"
  pcbTraceGap="0.12mm"
  pcbSpacingToOtherSignals="4w"
  targetDifferentialImpedance="125±25ohm" />
```

Values in this illustration come from the design, not the checker. Authors must extract requirements from their component specifications. Impedance tolerance strings are normalized by props into flat nominal/min/max numeric values. Explicit `targetImpedanceMin` and `targetImpedanceMax` work independently of a nominal target.

## Semantics

- `lengthMatchTo` adds resolved traces to the comparison set for `maxLengthSkew`, without changing the bus's electrical membership. The skew check measures the entire combined set.
- `minLength` and `maxLength` constrain individual member lengths. A number is absolute mm. `{ reference: "longest_manhattan", of: selectors, offset }` uses the longest endpoint Manhattan distance of the explicitly referenced traces; without `of`, it uses members plus `lengthMatchTo` references. Core resolves selectors to source-trace IDs before checks run.
- `targetLength` requires explicit `lengthTolerance`, including zero for exact matching. For a nominal length equal to the longest reference distance plus 300 mil with a 50 mil tolerance, use `targetLength={{ reference: "longest_manhattan", of: [".COMMANDS", ".CLOCK"], offset: "300mil" }}` and `lengthTolerance="50mil"`.
- `pcbTraceSpacing` checks centerline separation within the bus, excluding explicitly declared differential partners. `pcbSpacingToOtherSignals` checks copper outside the bus or pair, including partial routes and signals outside declared buses. A distance is absolute; `3w` uses three times the larger local trace width. Checks apply on common layers; same-net fragments are not different signals. There is no escape-spacing exception.
- Impedance min/max values check declared targets when supplied. Actual physical impedance remains unverified without stackup analysis. Differential impedance uses its own nominal/min/max fields without a single-ended conversion.

Geometry is measured from complete, unbranched pad-to-pad routes, including planar fanout fragments joined by explicit vias. Cached lengths are ignored. Missing, branched, disconnected or unsupported geometry remains unverified. Measurements use board-world XY in mm (+X right, +Y up); via barrel depth and electrical flight time are not inferred.

Violations use `pcb_bus_routing_constraint_error` with `routing_rule` as its discriminator and required rule-specific measurements. Unverified checks use `pcb_bus_routing_constraint_warning`, which has no measurement fields. Lengths and centerline spacing are in mm; impedance is in ohms. The selected rule defines its fields: `actual_length_skew`/`maximum_length_skew`, `actual_trace_length` and its minimum/maximum bound, target length with tolerance, actual/minimum centerline spacing, or impedance bounds. Both carry `source_bus_id`, `source_trace_ids`, `pcb_trace_ids` and readable messages; missing routes use an empty PCB-trace reference array, never a fabricated ID. A clean result establishes only these declared checks. Reference-plane continuity, power/termination circuits, decoupling, placement restrictions and signal integrity require separate validation; this checker does not certify an interface.
