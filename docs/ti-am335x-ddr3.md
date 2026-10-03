# TI AM335x DDR3 geometric checks

`checkPcbDdrRouting(circuitJson)` audits explicit `source_bus.ddr_routing` declarations against the one-x16 topology in [TI SPRS717L, Tables 7-62 and 7-66 through 7-69](https://www.ti.com/lit/ds/symlink/am3352.pdf). It also runs through `runAllRoutingChecks`.

Declare the intent in TSX using `pcbDdrRouting` on buses and differential pairs:

```tsx
<bus
  name="DATA_BYTE0"
  connections={["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "DM0"]}
  pcbDdrRouting={{
    profile: "ti_am335x_ddr3",
    interfaceName: "MEMORY",
    topology: "one_x16",
    signalClass: "dq",
    byteIndex: 0,
  }}
/>
<differentialpair
  name="STROBE_BYTE0"
  positiveConnection="DQS0"
  negativeConnection="DQS0_N"
  pcbDdrRouting={{
    profile: "ti_am335x_ddr3",
    interfaceName: "MEMORY",
    topology: "one_x16",
    signalClass: "dqs",
    byteIndex: 0,
  }}
/>
```

A complete interface requires `dq` and `dqs` groups for both bytes, one `ck` pair, and one `addr_ctrl` bus. Address/control includes CKE and ODT; RESETn is not in TI's ADDR_CTRL class. Interface names are scoped to the subcircuit. A data routing bus may also include its associated strobes; their explicit pair membership separates the semantic classes during the audit. A check-only bus can use `routingDisabled` to retain metadata without creating a new autorouter group.

The profile is requirement intent, not a claim that the board meets it. `targetImpedance`, `targetDifferentialImpedance`, and reference-net names remain optional author inputs; no stackup or electrical values are inferred.

## Implemented geometric rules

- Nine data/mask members per byte, two members and explicit polarity per pair, complete interface role coverage, and distinct class membership.
- Byte skew and associated data-to-strobe skew: 25 mil maximum. Clock/strobe differential skew: 5 mil maximum. No cross-byte matching requirement is introduced.
- Data nominal length: the byte's longest Manhattan pad-to-pad distance is the maximum. The skew tolerance is not added to that maximum.
- Address/control and clock: the common nominal length is the longest Manhattan endpoint distance plus 300 mil, with a ±50 mil window.
- DDR centreline spacing: 3w within a data byte or address/control group, otherwise 4w; pair-internal spacing is excluded because it is governed by impedance. Reduced spacing to w is limited to 1250 mil per signal. Overlapping close-neighbour intervals are unioned rather than double-counted. This audit covers declared DDR members; unrelated copper requires the region/keepout audit below.
- Declared single-ended impedance targets: 50–75 ohms; differential targets are interpreted as twice the single-ended value.
- Minimum board layer count: four.

Distances are board-world XY millimetres (+X right, +Y up). Measurement includes pad-to-via dogbones and supports connected route fragments joined by explicit vias. Cached `trace_length` values and guessed via depths are not used. Missing, disconnected, branched or unsupported geometry produces an `unverified` finding rather than a zero-length route. Tapers and through-pad geometry are currently unsupported by this audit.

## Requirements that remain unverified

The first implementation does **not** provide these physical/electrical audits. They always remain explicit `unverified` findings:

- Actual impedance per segment, differential impedance and stackup.
- Continuous adjacent reference planes, plane cuts and reference-change bypassing.
- Placement limits in the processor DDR-edge coordinate frame.
- DDR-region keepout and isolation from unrelated signal layers.
- Address/clock topology segment, stub/branch limits and termination.
- Supply decoupling quantity, capacitance and placement; permitted termination; programmed ODT.
- Via barrel depth, propagation delay and signal integrity.

A generic DRC pass or a successful autoroute cannot clear these findings. The AM3352 example deliberately reports TI nominal-length violations and missing physical information while retaining its fully connected reference routes.

Every result is a `pcb_ddr_routing_error` with `status: "violation" | "unverified"`, a stable rule name, specification/section, structured geometry IDs and readable messages. Treat **either** status as blocking a DDR compliance claim. These checks do not certify a manufacturable, electrically validated DDR interface.
