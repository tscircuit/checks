# Capacitor trace-length investigation

The published `abse/gameboy-advance@0.0.15` circuit, built with `tscircuit@0.0.2827` and `@tscircuit/checks@0.0.247`, contains the reported 21 findings. Its source configures 5.5 mm; this investigation does not independently verify a datasheet limit or establish fabrication defects from that threshold.

The review's partition is preserved: 14 connections are not direct IC decoupling paths, one finding aggregates the ground network, and six local connections remain layout-review candidates. Inspecting the published TSX adds a necessary distinction: eight of the fourteen non-decoupling connections explicitly author `maxLength=5.5`. Their independent trace constraints remain enforceable after removing the decoupling classification. Six inherited non-decoupling rules and the inherited capacitor-to-ground-net rule are removed.

## Six retained review candidates

All six retain their configured 5.5 mm requirement. Roles below come from the connection-level review and published source, separately from automatic topology inference. Unspecified roles in compiled metadata remain unspecified until authored; capacitor value or a shared rail alone cannot distinguish decoupling, bulk and regulator-loop requirements.

| Connection | Capacitor role and associated IC/pin | Relevant physical path | Limit origin |
| --- | --- | --- | --- |
| `C_VREG_AVDD_P` | C_VREG_AVDD, local regulator analog-supply decoupling to U1.VREG_AVDD | Indeterminate total; routed copper lower bound **3.55 mm**, with two top–inner1 transitions whose depths are unavailable | Configured capacitor `maxDecouplingTraceLength` |
| `C_CORE_G` | C_CORE, regulator output capacitor return to U1.VREG_PGND; the other terminal joins the inductor output and VREG_FB | **Indeterminate plane return**; neither a branch total nor the ground-network total is its actual return path | Configured capacitor `maxDecouplingTraceLength`; role is unspecified in the original model |
| `PSRAM_DECOUPLING` | C_PSRAM, 100 nF decoupling to U_PSRAM.VDD | Indeterminate total; routed copper lower bound **4.78 mm**, with two top–inner2 transitions requiring stackup depths | Authored trace `maxLength` |
| `PSRAM_BULK` | C_PSRAM_BULK, 1 µF local bulk supply capacitor to U_PSRAM.VDD | Indeterminate total; routed copper lower bound **5.64 mm**, with two top–inner2 transitions requiring stackup depths | Authored trace `maxLength`; bulk requirements remain separate |
| `PSRAM_VSS_GND_BRIDGE` | C_PSRAM, return bridge to U_PSRAM.VSS | Authored routed connection **14.24 mm**, including two full-board via transitions using the published 1.6 mm board thickness | Authored trace `maxLength`; this measures the authored trace, not plane current distribution |
| `BAT_INPUT_CAP_B` | C_BAT_IN_BULK_B, 10 µF regulator input bulk capacitor to U_BAT_BUCKBOOST.VIN | Authored routed connection **5.85 mm**, with no layer transitions | Authored trace `maxLength`; regulator input-loop requirements remain separate |

A known copper lower bound is not a complete measured distance. When known copper alone exceeds the configured rule, the violation remains an error with `actual_trace_length_is_lower_bound: true` and method `copper_path_lower_bound`; unresolved depth can only increase that minimum. This applies to PSRAM bulk, whose total remains indeterminate. The two measurable authored routes also exceed the configured rule. None of these results alone establishes a hardware or fabrication defect. Obtain the actual layer stackup and device-specific decoupling, bulk-capacitor and regulator guidance before making that decision.

## Other original findings

These connections are not automatically constrained as direct decoupling connections. An authored constraint is preserved even if a trace touches a capacitor or shares its rail.

| Connection | Electrical purpose | Original reported distance (mm) | Constraint after correction |
| --- | --- | ---: | --- |
| `C_DVDD2_BULK_SUPPLY` | Bulk capacitor to local capacitor supply bridge | 5.85 | Authored `maxLength` retained |
| `LCD_UNUSED_RD_HIGH` | Connector signal pull-up to capacitor supply node | 8.62 | Inherited decoupling rule removed |
| `IOVDD6_IOVDD5_BRIDGE` | Capacitor-to-capacitor supply bridge | 7.01 | Inherited decoupling rule removed |
| `IOVDD4_IOVDD5_BRIDGE` | Capacitor-to-capacitor supply bridge | 6.53 | Inherited decoupling rule removed |
| `VREG_AVDD_CORE_GND_BRIDGE` | Capacitor-to-capacitor ground bridge | 9.21 | Authored `maxLength` retained |
| `XIN_IOVDD4_GND_BRIDGE` | Crystal-load capacitor to supply capacitor ground bridge | 7.07 | Authored `maxLength` retained; crystal signal constraints remain independent |
| `CORE_VREG_IN_GND_BRIDGE` | Regulator capacitor ground bridge | 6.69 | Authored `maxLength` retained |
| `V3V3_AVDD_ADC_BRIDGE` | Supply bridge from resistor node to capacitor | 10.46 | Inherited decoupling rule removed |
| `QSPI_IOVDD6_GND_BRIDGE` | Capacitor-to-capacitor ground bridge | 9.93 | Authored `maxLength` retained |
| `AMP_CAP_GROUND_BRIDGE` | EMI-filter and supply-capacitor ground bridge | 6.30 | Inherited decoupling rule removed |
| `FLASH_GND_EP_MANUAL_BRIDGE` | IC ground-to-exposed-pad bridge; no capacitor endpoint | 7.90 | Authored `maxLength` retained |
| `ADC_DVDD1_OFFPAD_GND` | Capacitor-to-capacitor ground bridge | 8.13 | Authored `maxLength` retained |
| `VBUS_XOUT_OFFPAD_GROUND` | Input bulk and crystal-load capacitor ground bridge | 8.34 | Authored `maxLength` retained |
| `BAT_OUTPUT_FEEDBACK_LINK` | Regulator output-capacitor node to feedback resistor | 9.98 | Inherited decoupling rule removed; regulator feedback requirements remain independent |

`C_IOVDD5_GND` is the separate aggregation artifact: its original **665.6077535494062 mm** is the sum of **72** PCB branches attributed to the source trace. It is not the capacitor's local return distance. The corrected source model does not attach an inferred decoupling limit to this capacitor-to-net connection. Analyzing the old constrained JSON reports an indeterminate connected-plane return, never that aggregate distance.

## Implementation and interpretation

Core identifies two-terminal local capacitor/IC connections before propagating a capacitor limit. Supply inputs require pin attributes or recognized supply aliases; ground returns require association with the same IC through the capacitor's other terminal. Signal names such as VREF and VREG_FB are not supply inputs. The configured C_CORE regulator-return candidate retains its local configured requirement without being called inferred supply decoupling.

`capacitorRole` accepts `decoupling`, `bulk`, `regulator_input`, `regulator_output`, `crystal_load`, `filter` or `unspecified`. It is optional, has no authored default or aliases, and parses to the same enum. Declared roles other than decoupling disable automatic decoupling limits and require their own layout rules, usually authored trace `maxLength`. Existing designs can omit the new prop; genuine local decoupling topology still supports automatic policy inference. A configured capacitor limit does not independently establish its role. Existing explicit trace limits, crystal limits and via-count requirements remain independent.

Circuit JSON carries `max_length_origin` and the local capacitor/IC-port association. The checker reports that context, the limit origin, traversed trace/via identifiers, the measurement method and any uncertainty. Legacy JSON without provenance is not guessed to be explicit or inferred: its origin is reported as unavailable. Recompile with the corrected core, or use known authored-source evidence, to remove stale inferred rules safely.

Measurement uses a graph of physical routed centreline segments, copper contacts, pad traversals and via barrels. T junctions split segments; disconnected islands, unplated layer crossings and unrelated net branches do not form a local measured path. Cached whole-trace lengths do not override available geometry. Vias use known board thickness for outer-layer spans; inner-layer depths are indeterminate without a stackup. Numerical lower bounds omit unresolved depth and remain explicitly marked incomplete.

For inferred/configured capacitor rules, the graph follows the associated electrical network and reports an indeterminate return when connected plane copper prevents resolving a unique routed path. Authored trace `maxLength` constrains the authored routed connection: a shared plane does not erase a measurable explicit trace-length violation. A plane-only authored connection still requires review rather than an invented wire length. This distinction preserves explicit constraints while avoiding claims about plane return-current distribution.

`analyzePcbTraceLengths` returns within-limit, exceeds-limit and indeterminate findings. `checkPcbTraceLengths` returns only confirmed `pcb_trace_too_long_error` violations: either a complete measured path or a known path minimum already above the configured limit. The latter remains explicit about its indeterminate total. False capacitor classifications are removed; real violations retain their error severity. Unresolved plane, stackup or fragment paths without evidence of a violation remain explicitly indeterminate in the analysis/report and are never relabeled as DRC warnings or marked as verified passes. No distance or trace identifier is fabricated. Physical DRC and short-check implementations are unchanged.

## Reproduction and validation

The offline fixture at `tests/fixtures/gameboy-advance-0.0.15/circuit.json` preserves all 7,423 elements of the published preview. It was retrieved from:

- `https://api.tscircuit.com/package_releases/get_preview_circuit_json?package_name_with_version=abse%2Fgameboy-advance%400.0.15`
- `https://api.tscircuit.com/package_releases/get_filesystem_map?package_name_with_version=abse%2Fgameboy-advance%400.0.15`

`trace-constraints.json` contains only constraint/provenance fields produced by rendering the unedited published TSX through the corrected core's source phases. All **544** source traces retained their port endpoints and named-net identities. The original PCB data is preserved verbatim. `review-evidence.json` records the six review roles separately; it does not alter copper, constraints or pin attributes.

Run from this package:

```sh
bun test tests/lib/check-pcb-trace-paths.test.ts tests/lib/gameboy-capacitor-trace-lengths.test.ts
bun scripts/report-gameboy-capacitor-lengths.ts
bun scripts/verify-gameboy-physical-checks.ts
```

The report covers every original finding in `reports/gameboy-capacitor-lengths.json`. `reports/gameboy-physical-checks.json` records identical before/after results for **17** physical/source checks. Sixteen checks, including copper shorts and pad/via/trace clearance, return zero findings; the trace-thickness check preserves the same **25** existing warnings. No board placement, copper, plane, via, layer stack, width, clearance rule or short check is changed.

The implementation spans `circuit-json`, `props`, `core` and `checks`. Build with the updated sibling packages; release the new schema and props before consuming these changes in core/checks. The legacy project and its pinned runtime are retained as investigation evidence; no published board or package was replaced.
