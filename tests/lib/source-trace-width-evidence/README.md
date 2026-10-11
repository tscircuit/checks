Two source-owned routes share an electrical net through a common PCB port.
The USB ground route requires and uses 0.5 mm; the TEC hot loop requires and
uses 3 mm. Each has a separate branch requiring and using 0.2 mm. Neither
compliant route should warn. The current checker instead compares the branch
against the wider route's requirement.

`failing.svg` renders actual copper and actual warning centers from
`runAllRoutingChecks`; `failing.json` records the returned width warnings.
These are observed failure evidence, not accepted snapshot baselines.

Run the annotated reproduction (3 passing tests):

```sh
TRACE_WIDTH_EVIDENCE=tests/lib/source-trace-width-evidence/failing bun test tests/lib/check-trace-width-source-attribution.test.ts
```

Replace the regression's `test.failing` with `test` and rerun to see the
ordinary assertion failure captured in `failing.txt` (2 pass, 1 fail).
The undersized owned USB route and the legacy unowned-route control pass in
both runs. The original checker remains unchanged on this branch.

The separate short-neckdown allowance is intentional: the checker documents
a requested-width-sized escape beyond each connected endpoint pad. Existing
pad-escape tests cover this policy. Source attribution must not change it;
`maxPadNeckdownLength: 0` removes the escape allowance but still exempts copper
inside endpoint pads.
