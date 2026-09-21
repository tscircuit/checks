# AM3352 routing DRC benchmark

Run from the repository root:

```sh
bun scripts/benchmarks/benchmark01-am3552.ts
```

The filename retains the requested `am3552` spelling; the fixture is the AM3352
four-layer dogbone board from
https://tscircuit.com/seveibar/am3352-dev-board-4layer-dogbone (version 0.1.3).
`fixtures/am3352.circuit.json.gz` is a fixed, gzip-compressed build output with
1,975 PCB traces. Keeping it in the repository avoids network, autorouting, and
registry changes affecting comparisons.

The script reports each of five runs, their arithmetic mean, the error count,
and a SHA-256 of the complete ordered diagnostics. Input decompression, cloning,
and result hashing are outside the timers. Every run gets fresh input because
endpoint inference mutates routes. There is no separate warm-up run. Measurements
cover `runAllRoutingChecks`, not the entire board build.

## Incremental measurements

Measured on macOS arm64 with Bun 1.3.2, using the same installed dependencies
(`circuit-json-to-connectivity-map` 0.0.30) throughout:

| Implementation | Five-run average | Reduction from baseline |
| --- | ---: | ---: |
| checks main at d51ec29 | 6,741.25 ms | — |
| Shared logical and physical maps per routing pass | 4,588.56 ms | 31.9% |
| Shared maps + Flatbush trace candidates and indexed port links | 3,370.02 ms | 50.0% |
| + Cached polygon geometry and Flatbush edge contact tests | 1,560.04 ms | 76.9% |

All stages returned the same 59 diagnostics, with hash
`9ae5e1cde710ee69b62d80dc65818213081f7628c934b56b69bed46802ba81c0`.
This uses the upstream checks/dependencies, without the board workspace's local
connectivity patches. The existing diagnostics are preserved, not suppressed;
this is a performance fixture, not a board qualification test.

For future additions, run this script before and after the change with the same
dependencies and compare both the average and diagnostic hash. For the pre-PR
baseline, copy the script and fixture into a worktree at d51ec29. Timings vary
with machine load; they are informational rather than CI timing assertions.

## Copper-pour contact follow-up

An immediate before/after comparison on main at `ac297c1` (which includes the
shared-map optimization) measured **3,090.43 ms → 1,560.04 ms**, a **49.5%**
reduction. Both measurements used five fresh-input runs in separate processes,
with unchanged dependencies and no tests running concurrently. Individual times:

- Before: 3,022.36, 3,190.25, 3,095.87, 3,090.74, 3,052.95 ms.
- After: 1,577.77, 1,599.84, 1,519.01, 1,568.43, 1,535.13 ms.

The contact tester caches each polygon's boundary geometry for one connectivity
pass. It checks a representative point from every face for containment, then
uses Flatbush to select nearby edges for exact segment/arc distance tests. Holes,
separate faces, and the existing scaled contact tolerance remain part of the
calculation. The same 59 diagnostics and SHA-256 above were preserved.

## Flatten.js PlanarSet alternative

This alternative to PR #318 uses the existing `polygon.edges` PlanarSet rather
than constructing a second Flatbush index. A tolerance-expanded `Box` query
returns candidate polygon edges, followed by the same exact segment/arc distance
predicate. Cached bounds, representative points, and containment logic are
identical to the Flatbush version.

Compared against the Flatbush implementation at `efabc07` using the same fixture,
dependencies, Bun 1.3.2, and machine. Each entry is the arithmetic mean from a
separate five-run process; there were no concurrent tests. Reversing the order
checks whether the small difference is reproducible:

| Run order | Flatbush average | PlanarSet average |
| --- | ---: | ---: |
| Flatbush, then PlanarSet | 1,561.04 ms | 1,549.63 ms |
| PlanarSet, then Flatbush | 1,611.99 ms | 1,611.15 ms |

All 20 runs returned the same 59 diagnostics and the SHA-256 recorded above.
The difference is below 1% in both comparisons: neither implementation has a
meaningful demonstrated speed advantage on this board. PlanarSet avoids building
and maintaining the additional edge index. No memory savings were measured.
Flatbush remains in use for the other routing checks.

Run `bun scripts/benchmarks/benchmark01-am3552.ts` on this branch and on `efabc07`
with identical installed dependencies to repeat the comparison.
