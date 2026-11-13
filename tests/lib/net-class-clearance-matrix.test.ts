import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import {
  checkDifferentNetViaSpacing,
  checkEachPcbTraceNonOverlapping,
  checkPadPadClearance,
  checkPadTraceClearance,
  checkViaPadClearance,
  checkViaTraceClearance,
  runAllChecks,
} from "../../index"

const createSourceNet = (
  id: string,
  name: string,
  extra?: Record<string, any>,
): AnyCircuitElement =>
  ({
    type: "source_net",
    source_net_id: id,
    name,
    member_source_group_ids: [],
    ...extra,
  }) as AnyCircuitElement

const createPad = (
  id: string,
  x: number,
  y: number,
  netId?: string,
): AnyCircuitElement[] => [
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: id,
    shape: "rect",
    x,
    y,
    width: 1,
    height: 1,
    layer: "top",
    pcb_port_id: `port_${id}`,
  },
  {
    type: "pcb_port",
    pcb_port_id: `port_${id}`,
    source_port_id: `src_port_${id}`,
    x,
    y,
    layers: ["top"],
  },
  ...(netId
    ? [
        {
          type: "source_trace" as const,
          source_trace_id: `st_${id}`,
          connected_source_port_ids: [`src_port_${id}`],
          connected_source_net_ids: [netId],
        },
      ]
    : []),
]

const createTrace = (
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  netId?: string,
  thickness = 0.2,
): AnyCircuitElement[] => [
  {
    type: "pcb_trace",
    pcb_trace_id: id,
    source_trace_id: `st_${id}`,
    route: [
      { route_type: "wire", x: x1, y: y1, width: thickness, layer: "top" },
      { route_type: "wire", x: x2, y: y2, width: thickness, layer: "top" },
    ],
  },
  ...(netId
    ? [
        {
          type: "source_trace" as const,
          source_trace_id: `st_${id}`,
          connected_source_net_ids: [netId],
          connected_source_port_ids: [],
        },
      ]
    : []),
]

const createVia = (
  id: string,
  x: number,
  y: number,
  netId?: string,
): AnyCircuitElement[] => [
  {
    type: "pcb_via",
    pcb_via_id: id,
    x,
    y,
    hole_diameter: 0.4,
    outer_diameter: 0.8,
    layers: ["top", "bottom"],
    pcb_trace_id: `tr_${id}`,
  },
  {
    type: "pcb_trace",
    pcb_trace_id: `tr_${id}`,
    source_trace_id: `st_${id}`,
    route: [],
  },
  ...(netId
    ? [
        {
          type: "source_trace" as const,
          source_trace_id: `st_${id}`,
          connected_source_net_ids: [netId],
          connected_source_port_ids: [],
        },
      ]
    : []),
]

test("named net class HV (clearance: 3mm) flags HV-to-logic trace violation while logic-to-logic at 0.2mm passes", () => {
  // Logic traces 1 & 2 at x in [0, 5], gap = 0.4 - 0.2 = 0.2mm (passes > 0.1mm)
  // Logic trace 2 extends to x=15.
  // HV trace at x in [10, 15], y=2.0 -> gap to logic trace 2 is 2.0 - 0.4 - 0.2 = 1.4mm (< 3.0mm)
  // Distance from HV trace to Logic trace 1 is > 5mm (passes >= 3.0mm)
  const circuit: AnyCircuitElement[] = [
    createSourceNet("net_logic1", "LOGIC1"),
    createSourceNet("net_logic2", "LOGIC2"),
    createSourceNet("net_hv", "HV"),
    ...createTrace("tr_logic1", 0, 0, 5, 0, "net_logic1", 0.2),
    ...createTrace("tr_logic2", 0, 0.4, 15, 0.4, "net_logic2", 0.2),
    ...createTrace("tr_hv", 10, 2.0, 15, 2.0, "net_hv", 0.2),
  ]

  const errors = checkEachPcbTraceNonOverlapping(circuit, {
    minClearance: 0.1,
    netClasses: [{ name: "HV", clearance: 3, nets: ["HV"] }],
  })

  // Logic1 vs Logic2 gap is 0.2mm (> 0.1mm) -> PASSES!
  // HV vs Logic2 gap is 1.4mm (< 3.0mm) -> FAILS!
  expect(errors.length).toBe(1)
  expect((errors[0] as any).pcb_trace_id).toBe("tr_logic2")
  expect((errors[0] as any).message).toContain("too close")
})

test("named net class HV (clearance: 3mm) flags pad-to-pad, trace-to-pad, and via-to-pad violations", () => {
  // Region 1: Logic-to-logic pads at x=0, gap = 1.4 - 1.0 = 0.4mm (> 0.15mm) -> PASSES
  // Region 2: HV-to-logic pads at x=20, gap = 2.5 - 1.0 = 1.5mm (< 3.0mm) -> FAILS
  // Region 3: HV pad at x=40, y=0. Trace logic at x=40, y=-1.5 -> gap = 1.5 - 0.5 - 0.1 = 0.9mm (< 3.0mm) -> FAILS
  // Region 4: HV pad at x=60, y=0. Via logic at x=60, y=2.0 -> gap = 2.0 - 0.5 - 0.4 = 1.1mm (< 3.0mm) -> FAILS
  const circuit: AnyCircuitElement[] = [
    createSourceNet("net_logic", "LOGIC"),
    createSourceNet("net_logic2", "LOGIC2"),
    createSourceNet("net_hv", "HV"),
    // Region 1: Logic to logic (passes)
    ...createPad("pad_logic_a", 0, 0, "net_logic"),
    ...createPad("pad_logic_b", 0, 1.4, "net_logic2"),
    // Region 2: HV to logic pad (fails)
    ...createPad("pad_logic_c", 20, 0, "net_logic"),
    ...createPad("pad_hv_d", 20, 2.5, "net_hv"),
    // Region 3: HV pad to logic trace (fails)
    ...createPad("pad_hv_e", 40, 0, "net_hv"),
    ...createTrace("tr_logic_e", 38, -1.5, 42, -1.5, "net_logic", 0.2),
    // Region 4: HV pad to logic via (fails)
    ...createPad("pad_hv_f", 60, 0, "net_hv"),
    ...createVia("via_logic_f", 60, 2.0, "net_logic"),
  ]

  const netClasses = [{ name: "HV", clearance: 3, nets: ["HV"] }]

  // 1. Pad-to-pad
  const padPadErrors = checkPadPadClearance(circuit, {
    minClearance: 0.15,
    netClasses,
  })
  expect(padPadErrors.length).toBe(1)
  expect(padPadErrors[0].minimum_clearance).toBe(3)
  expect(padPadErrors[0].pcb_pad_ids).toContain("pad_logic_c")
  expect(padPadErrors[0].pcb_pad_ids).toContain("pad_hv_d")

  // 2. Pad-to-trace
  const padTraceErrors = checkPadTraceClearance(circuit, {
    minClearance: 0.15,
    netClasses,
  })
  expect(padTraceErrors.length).toBe(1)
  expect(padTraceErrors[0].minimum_clearance).toBe(3)
  expect(padTraceErrors[0].pcb_pad_id).toBe("pad_hv_e")
  expect(padTraceErrors[0].pcb_trace_id).toBe("tr_logic_e")

  // 3. Via-to-pad
  const viaPadErrors = checkViaPadClearance(circuit, {
    minClearance: 0.15,
    netClasses,
  })
  expect(viaPadErrors.length).toBe(1)
  expect(viaPadErrors[0].minimum_clearance).toBe(3)
  expect(viaPadErrors[0].pcb_pad_ids).toContain("via_logic_f")
  expect(viaPadErrors[0].pcb_pad_ids).toContain("pad_hv_f")
})

test("class-to-class clearance matrix: HV-to-LV requires 4mm, HV-to-HV requires 1.5mm, LV-to-LV uses default", () => {
  const circuit: AnyCircuitElement[] = [
    createSourceNet("sn_hv1", "HV1"),
    createSourceNet("sn_hv2", "HV2"),
    createSourceNet("sn_lv1", "LV1"),
    createSourceNet("sn_lv2", "LV2"),
    // Region 1 (x=0): LV1 and LV2 pads -> gap = 1.4 - 1.0 = 0.4mm (> 0.2mm default) -> PASSES
    ...createPad("pad_lv1", 0, 0, "sn_lv1"),
    ...createPad("pad_lv2", 0, 1.4, "sn_lv2"),
    // Region 2 (x=20): HV1 and HV2 pads -> gap = 3.0 - 1.0 = 2.0mm (>= 1.5mm matrix required) -> PASSES
    ...createPad("pad_hv1", 20, 0, "sn_hv1"),
    ...createPad("pad_hv2", 20, 3.0, "sn_hv2"),
    // Region 3 (x=40): HV1 and LV1 pads -> gap = 3.0 - 1.0 = 2.0mm (< 4.0mm matrix required) -> FAILS
    ...createPad("pad_hv3", 40, 0, "sn_hv1"),
    ...createPad("pad_lv3", 40, 3.0, "sn_lv1"),
  ]

  const options = {
    minClearance: 0.2,
    netClasses: [
      { name: "HV", nets: ["HV1", "HV2"] },
      { name: "LV", nets: ["LV1", "LV2"] },
    ],
    clearanceMatrix: {
      HV: { LV: 4, HV: 1.5 },
    },
  }

  const errors = checkPadPadClearance(circuit, options)

  // Only pad_hv3 vs pad_lv3 should fail with required clearance = 4mm!
  expect(errors.length).toBe(1)
  expect(errors[0].minimum_clearance).toBe(4)
  expect(errors[0].pcb_pad_ids).toContain("pad_hv3")
  expect(errors[0].pcb_pad_ids).toContain("pad_lv3")
})

test("class-to-class clearance matrix: via-to-via and via-to-trace honour matrix", () => {
  const circuit: AnyCircuitElement[] = [
    createSourceNet("sn_hv", "HV"),
    createSourceNet("sn_lv", "LV"),
    // Via HV at (0, 0) (outer_diameter 0.8mm)
    ...createVia("via_hv", 0, 0, "sn_hv"),
    // Via LV at (3.0, 0) -> copper gap = 3.0 - 0.8 = 2.2mm (< 4.0mm matrix)
    ...createVia("via_lv", 3.0, 0, "sn_lv"),
    // Trace LV along y=2.0 from x=-2 to 2 (thickness 0.2)
    // Distance from via_hv center (0,0) to trace (y=2.0) is 2.0 - 0.4 - 0.1 = 1.5mm (< 4.0mm matrix)
    ...createTrace("tr_lv", -2, 2.0, 2, 2.0, "sn_lv", 0.2),
  ]

  const options = {
    minClearance: 0.2,
    netClasses: [
      { name: "HV", nets: ["HV"] },
      { name: "LV", nets: ["LV"] },
    ],
    clearanceMatrix: {
      HV: { LV: 4 },
    },
  }

  const viaViaErrors = checkDifferentNetViaSpacing(circuit, options)
  expect(viaViaErrors.length).toBe(1)
  expect(viaViaErrors[0].minimum_clearance).toBe(4)

  const viaTraceErrors = checkViaTraceClearance(circuit, options)
  expect(viaTraceErrors.length).toBe(1)
  expect(viaTraceErrors[0].minimum_clearance).toBe(4)
})

test("circuitJson embedded net_class and clearance_matrix metadata are discovered automatically", async () => {
  const circuit: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board_1",
      width: 100,
      height: 100,
      center: { x: 0, y: 0 },
      net_classes: [
        { name: "HV", clearance: 3.5, nets: ["HV"] },
        { name: "LV", clearance: 0.2, nets: ["LV"] },
      ],
      clearance_matrix: {
        HV: { LV: 4.5 },
      },
    } as any,
    createSourceNet("sn_hv", "HV", { net_class: "HV" }),
    createSourceNet("sn_lv", "LV", { net_class: "LV" }),
    // Pad LV at (0, 0)
    ...createPad("pad_lv", 0, 0, "sn_lv"),
    // Pad HV at (3.5, 0) -> gap = 3.5 - 1.0 = 2.5mm (< 4.5mm required)
    ...createPad("pad_hv", 3.5, 0, "sn_hv"),
  ]

  // Run all checks without passing explicit options
  const allErrors = await runAllChecks(circuit)
  const padErrors = allErrors.filter(
    (e) => e.type === "pcb_pad_pad_clearance_error",
  )

  expect(padErrors.length).toBe(1)
  expect((padErrors[0] as any).minimum_clearance).toBe(4.5)
})

test("trace-to-trace clearance matrix: HV-to-LV requires 4mm, HV-to-HV requires 1.5mm", () => {
  const circuit: AnyCircuitElement[] = [
    createSourceNet("sn_hv1", "HV1"),
    createSourceNet("sn_hv2", "HV2"),
    createSourceNet("sn_lv1", "LV1"),
    // Region 1: HV1 and HV2 parallel traces at x in [0, 10]:
    // tr_hv1 at y=0, tr_hv2 at y=2.2 -> gap = 2.2 - 0.2 = 2.0mm (>= 1.5mm matrix required) -> PASSES
    ...createTrace("tr_hv1", 0, 0, 10, 0, "sn_hv1", 0.2),
    ...createTrace("tr_hv2", 0, 2.2, 10, 2.2, "sn_hv2", 0.2),
    // Region 2: HV1 and LV1 parallel traces at x in [20, 30]:
    // tr_hv_b at y=0, tr_lv_b at y=2.7 -> gap = 2.7 - 0.2 = 2.5mm (< 4.0mm matrix required) -> FAILS
    ...createTrace("tr_hv_b", 20, 0, 30, 0, "sn_hv1", 0.2),
    ...createTrace("tr_lv_b", 20, 2.7, 30, 2.7, "sn_lv1", 0.2),
  ]

  const errors = checkEachPcbTraceNonOverlapping(circuit, {
    minClearance: 0.1,
    netClasses: [
      { name: "HV", nets: ["HV1", "HV2"] },
      { name: "LV", nets: ["LV1"] },
    ],
    clearanceMatrix: {
      HV: { LV: 4, HV: 1.5 },
    },
  })

  // Only tr_hv_b vs tr_lv_b should fail
  expect(errors.length).toBe(1)
  expect((errors[0] as any).pcb_trace_id).toBe("tr_hv_b")
})

test("standalone net_class and clearance_matrix elements and direct source_net.clearance are honoured", async () => {
  const circuit: AnyCircuitElement[] = [
    {
      type: "source_net_class",
      name: "CRITICAL",
      clearance: 2.8,
      nets: ["NET_CRIT"],
    } as any,
    createSourceNet("sn_crit", "NET_CRIT"),
    createSourceNet("sn_direct", "NET_DIRECT", { clearance: 3.2 }),
    // Pad critical at (0, 0)
    ...createPad("pad_crit", 0, 0, "sn_crit"),
    // Pad direct at (0, 2.5) -> gap = 2.5 - 1.0 = 1.5mm (< 3.2mm required)
    ...createPad("pad_direct", 0, 2.5, "sn_direct"),
  ]

  const errors = checkPadPadClearance(circuit, { minClearance: 0.1 })
  expect(errors.length).toBe(1)
  expect(errors[0].minimum_clearance).toBe(3.2)
})
