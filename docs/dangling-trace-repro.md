# Dangling trace DRC: broken behavior

These snapshot reproductions explain why a visible dangling trace can produce no DRC error. The tests intentionally record the **broken baseline**: zero reported errors where one exposed endpoint should be reported. The follow-up fix updates these assertions and snapshots.

## A branch on a source-associated trace

Both required pads connect through the main trace. A second fragment with the same `source_trace_id` branches upward and ends in free space. Required-port validation skips subsequent fragments, and floating-endpoint validation excludes traces with expected ports.

![Broken source-associated branch](../tests/lib/__snapshots__/check-traces-are-contiguous-dangling-port-branch.snap.svg)

## The short ground stub from the AM3352 board

The published [AM3352 development board](https://tscircuit.com/seveibar/am3352-dev-board-4layer-dogbone#pcb) contains a GND trace extending past a via at `(10.825, 1.175)` mm. Its final 0.04999 mm segment ends at `(10.875, 1.44999)` mm. Its copper overlaps the preceding trace's rounded cap, which hides the exposed tip from the existing endpoint-contact rule.

This fixture preserves the two top-layer trace fragments and via coordinates, with a simplified terminal pad. It deliberately omits expected ports to isolate the short-stub problem from the source-attribution problem above. The nearby crystal pad is on another net; connecting the tip to it is not a fix.

![Broken short GND stub](../tests/lib/__snapshots__/check-traces-are-contiguous-short-dangling-stub.snap.svg)

All coordinates are board/world points in millimeters: +X right, +Y top, +Z above, right-handed. Both snapshots contain their own explanatory text so they can be reviewed without this document.

Run both reproductions:

```sh
bun test tests/lib/check-traces-are-contiguous-dangling-port-branch.test.ts tests/lib/check-traces-are-contiguous-short-dangling-stub.test.ts
```
