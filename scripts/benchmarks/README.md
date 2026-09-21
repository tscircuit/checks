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

All three stages returned the same 59 diagnostics, with hash
`9ae5e1cde710ee69b62d80dc65818213081f7628c934b56b69bed46802ba81c0`.
This uses the upstream checks/dependencies, without the board workspace's local
connectivity patches. The existing diagnostics are preserved, not suppressed;
this is a performance fixture, not a board qualification test.

For future additions, run this script before and after the change with the same
dependencies and compare both the average and diagnostic hash. For the pre-PR
baseline, copy the script and fixture into a worktree at d51ec29. Timings vary
with machine load; they are informational rather than CI timing assertions.
