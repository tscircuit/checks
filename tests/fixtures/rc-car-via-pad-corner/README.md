# RC-car board evidence for issue #241

**The fault in this fixture was intentionally introduced for testing. It was
not found in the original RC-car board, and this is not a fabricated-hardware
failure report.**

The control is the complete routed 60 x 45 mm, two-layer
[RC-car ESC/servo carrier](https://tscircuit.com/hrithik18k/rc-car-esc-xiao-20261025)
created for this project. `original.circuit.tsx` is its formatted authoring source;
`original.circuit.json` freezes the reviewed copper so this test does not depend
on an autorouter producing the same result again. The board was built with
`tscircuit@0.0.3016`. It has no placement findings and no detected Gerber shorts.

The carrier is CarKit-inspired; the retained MIT notice credits Logan Peterson.
This evidence modifies the carrier, rather than claiming a fault in the upstream
CarKit design.

## Exact intentional change

`introduce-fault.ts` appends just two records and preserves every original record:

- A GND via at **(5.4, 10.875) mm**, with 0.6 mm copper diameter, 0.3 mm drill,
  and top/bottom copper.
- A 0.3 mm bottom-layer GND spur from the existing ground via at
  **(0.655, 10.984) mm** to the added via. This physically connects the added via
  to the existing ground network. It is not an isolated disk merely labeled GND.

R1.pin1 belongs to ESC_GPIO. Its rectangular pad spans x=5.575..6.6 mm and
y=9.3..10.7 mm. The added via center lies outside both pad axes. Its distance to
the closest corner is about 0.2475 mm: the 0.3 mm copper radius overlaps by about
0.0525 mm, while the 0.15 mm drill radius stays clear. The drill-in-pad checker
correctly returns no finding; different-net copper clearance must still fail.

No original traces, vias, components, source nets or pins are moved, deleted,
rerouted or relabeled. The original board has 13 vias; the test variant has 14.

## Observed results

| Input copper | Published placement checker 0.0.264 | Fixed placement checker | Gerber shorts, both layers |
| --- | ---: | ---: | ---: |
| Original board | 0 errors | 0 errors | 0; CLI exit 0 |
| Intentionally added fault | 0 errors | 1 error at R1.pin1 | 1 top-layer short; CLI exit 1 |

**Before and after refer to the checker implementation. The faulty copper is
identical in both snapshots and remains shorted after detection.** The original
clean board is a separate control.

The before result executes the actual pinned npm package via the development-only
`checks-before-via-pad-placement` alias. It is not produced by filtering out the
new diagnostic. The after result executes this PR's source.

- [Before, complete board](../../repros/__snapshots__/rc-car-intentional-fault-before.snap.svg)
- [After, complete board](../../repros/__snapshots__/rc-car-intentional-fault-after.snap.svg)
- [Before, corner detail](../../repros/__snapshots__/rc-car-intentional-fault-before-zoom.snap.svg)
- [After, corner detail](../../repros/__snapshots__/rc-car-intentional-fault-after-zoom.snap.svg)
- [Original Gerber transcript](./original-gerber.log)
- [Intentional-fault Gerber transcript](./intentional-fault-gerber.log)
- [Gerber short bitmap](./gerber-short-bitmap.png)
- [Structured results and canonical input hash](./report.json)

The Gerber checker reports the short around (5.317, 10.821) mm. That bitmap
centroid also covers the signal trace entering R1.pin1; it is not intended as the
analytic pad-corner coordinate.

## Reproduce

From the repository root:

```sh
bun install
bun test tests/repros/rc-car-intentional-via-pad-fault.test.ts
bun scripts/generate-rc-car-via-pad-evidence.ts
```

The test command runs the two real placement implementations and compares four
native PCB snapshots. It also asserts that all original records remain unchanged,
that exactly one via and spur were added, and that the drill does not enter a pad.

The opt-in generation script downloads/runs **tscircuit 0.0.3016** via bunx and
executes `tsci check shorts` in **Gerber mode**, across **all layers**, at
**40 pixels/mm**. It checks the real exit codes and requires exactly zero shorts
for the control and one for the faulty variant. Runtime outputs are written to
`dist/rc-car-via-pad-evidence/`; the checked-in transcripts normalize only the
machine-specific repository path to `<repo>`.

The normal test suite performs no CLI downloads or Gerber subprocess runs.
To inspect the deliberately shorted variant directly after generation:

```sh
cd dist/rc-car-via-pad-evidence
bunx --bun --package tscircuit@0.0.3016 tsci check shorts intentional-fault.circuit.json --mode gerber --layer all --pixels-per-mm 40
```

That last command is expected to exit **1**. The intentionally faulty fixture is
diagnostic evidence, not a revised board release or a fabrication deliverable.
