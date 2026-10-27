The gzip fixture contains the complete, unmodified Circuit JSON downloaded from:
https://am3352-six-layer-routing-proof.seveibar.chatgpt.site/am3352/circuit.json.gz

SHA-256 of decompressed JSON:
`102347c87209faf6600229e7a5ec533b5eb90839cd904629457bd9a61e1dab02`

The end-to-end regression runs `checkCopperPourIslands` on the full board and
passes its warnings to the native `circuit-to-svg` renderer. All original geometry
is retained. Only pre-existing unrelated diagnostic records are hidden in renders.
