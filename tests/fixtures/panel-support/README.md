These fixtures retain only board, cutout, and NPTH geometry from
https://github.com/tscircuit/basic-usbc-devices:

- unsupported.json: panel4.circuit.json at a794298be6a72cefc3f9b59c527033f368f2dd86.
- supported.json: corrected carrier layout at 5d8091c (PR #1).

The original exports flatten all ten modules into a single pcb_board; the check
must recover mechanical regions without source board IDs or panelization metadata.
The failing regions centered at (9,19), (9,-47), (9,-14), and (12,49) correspond
to limit, toggle, dial, and buzzer. Copper/components are omitted to keep this a
mechanical regression independent of electrical DRC.
