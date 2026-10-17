# Dead-end copper-pour fingers

`checkCopperPourDeadEndFingers(circuitJson, options?)` reviews finished copper
pours for long, narrow branches attached through a single neck. It runs in
`runAllRoutingChecks` and therefore `runAllChecks`.

The checker returns a nonfatal `pcb_placement_error` for each candidate, with a
readable net name, layer, approximate tip coordinates, length, and width in the
message. These are suggestions for layout review, not a simulation of EMI or a
manufacturing rejection. Intentional copper features may need no change.

```ts
import { checkCopperPourDeadEndFingers } from "@tscircuit/checks"

const issues = checkCopperPourDeadEndFingers(circuitJson, {
  maxWidth: 1, // mm; maximum neck and average branch width
  minLength: 2, // mm; minimum estimated branch length
  minAspectRatio: 4, // minimum length / width
})
```

The values above are the defaults. Options must be positive and finite. Custom
thresholds apply to direct calls; the aggregate runners use the defaults.

The checker unites same-net pours on each layer, then looks for narrow cuts
across copper at concave corners and fillets. A cut must separate a small branch
from the remaining copper. Length is estimated from the branch's boundary and
its depth from the neck; width is the larger of neck width and area / estimated
length. This supports straight, bent, and rounded fingers while retaining BRep
cutouts. Duplicate pour records do not hide a finger.

A same-net pad, plated hole, via, or trace touching the distal half of the branch
suppresses that candidate. Distal means farther than half the tip's straight-line
distance from the neck. Contacts at the root do not suppress a long free tail.
Layer spans and logical net aliases use the shared geometry/connectivity tools;
another net, another layer, or a drill void does not count as contact.

This is deliberately a heuristic: it does not classify standalone narrow islands,
hole-bearing lobes, or every possible smooth/irregular protrusion. It does not
prove that a tip connection is useful electrically or connected to a ground
source. Connectivity checks and visual review remain necessary.
