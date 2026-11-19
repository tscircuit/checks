The gzip fixture contains the complete, unmodified `dist/index/circuit.json` of
`seveibar/rvboy-advance` v0.8.0, package release
`bb3effb5-7b41-4bc0-8c89-65c8c332d25f`.

SHA-256 of decompressed JSON:
`c661fa9ed23eae246d829a721917dada25332354140b705536ca1ea47dfcccda`

Polygon pads with zero-length edges used to make `checkDanglingTraces` pass every
trace end on their layer, so this board reported 0 errors while carrying dead
copper left by partial reroutes. All nets are connected, so connectivity checks
cannot see it either.

An audit of the copper that does not use this repo's checks found 63 items. The
60 `checkDanglingTraces` errors cover 57 of them, because the 4 floating fragments
report a free end on each side. The other 6 are correctly not reported:

| Item | Location | Why it is not a dangling endpoint |
| --- | --- | --- |
| `VBUS` piece, 0.009 mm long | (6.41, 29.61) top | Inside same-net copper |
| `KEY_IRQ` piece, 0.025 mm long | (-30.70, 21.71) inner2 | Inside same-net copper |
| `LCD_RESET` via | (49.16, 29.44) | Mid-chain. The chain's free end at (48.90, 29.70) is reported |
| `V3V3` via | (1.58, 18.69) | A route that is only a via, with no trace end |
| `KEY_L` via | (-57.48, 25.03) | A route that is only a via, with no trace end |
| `V1V8` via | (-6.69, 17.43) | A route that is only a via, with no trace end |

The audit's groups S28, S29 and S30 contain only these items, so they have no
zoomed view. Pours are hidden in the views so inner-layer stubs stay visible.
