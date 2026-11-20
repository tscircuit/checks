import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace, PcbVia } from "circuit-json"
import { checkHoleTraceClearance } from "../../lib/check-hole-trace-clearance"
import { runAllRoutingChecks } from "../../lib/run-all-checks"

const via = (id: string): PcbVia => ({
  type: "pcb_via",
  pcb_via_id: id,
  pcb_trace_id: "owner",
  x: 0,
  y: 0,
  hole_diameter: 0.3,
  outer_diameter: 0.5,
  layers: ["top", "bottom"],
})
const trace = (
  id: string,
  y: number,
  layer: "top" | "bottom" | "inner1" = "top",
): PcbTrace => ({
  type: "pcb_trace",
  pcb_trace_id: id,
  route: [
    { route_type: "wire", x: -1, y, width: 0.1, layer },
    { route_type: "wire", x: 1, y, width: 0.1, layer },
  ],
})

test("via drill edge clearance, independent of outer copper edge, and through layers", async () => {
  const hole = via("pcb_via_private_1")
  // Drill gap=0.15 mm; outer-copper gap=0.05 mm; hole rule is 0.2 mm.
  for (const layer of ["top", "bottom", "inner1"] as const) {
    const elements: AnyCircuitElement[] = [
      hole,
      trace("pcb_trace_private_1", 0.35, layer),
    ]
    const errors = checkHoleTraceClearance(elements, { minClearance: 0.2 })
    expect(errors).toHaveLength(1)
    expect(errors[0]!.message).toContain("unnamed via")
    expect(errors[0]!.message).not.toContain("pcb_via_private_1")
    expect(errors[0]!.message).not.toContain("pcb_trace_private_1")
    expect(errors[0]!.message).toContain("0.150000mm")
    expect(errors[0]!.pcb_trace_id).toBe("pcb_trace_private_1")
    expect(
      (await runAllRoutingChecks(elements)).some(
        (e) =>
          e.type === "pcb_trace_error" &&
          e.pcb_trace_id === "pcb_trace_private_1",
      ),
    ).toBe(true)
    expect(
      checkHoleTraceClearance(elements, { minClearance: 0.1 }),
    ).toHaveLength(0)
    const atBoundary = [hole, trace("far", 0.4, layer)]
    expect(
      checkHoleTraceClearance(atBoundary, { minClearance: 0.2 }),
    ).toHaveLength(0)
  }
})

test("connected via and trace do not trigger clearance; blind vias skip other layers", () => {
  const owner = trace("owner", 0.35)
  expect(
    checkHoleTraceClearance([via("v"), owner], { minClearance: 0.2 }),
  ).toHaveLength(0)
  const blind = { ...via("v"), layers: ["top", "inner1"] } as PcbVia
  expect(
    checkHoleTraceClearance([blind, trace("unrelated", 0.35, "bottom")], {
      minClearance: 0.2,
    }),
  ).toHaveLength(0)
  expect(
    checkHoleTraceClearance([blind, trace("unrelated", 0.35, "inner1")], {
      minClearance: 0.2,
    }),
  ).toHaveLength(1)
})

test("named diagnostics and overlapping local ids remain distinct", () => {
  const namedVia = { ...via("same"), name: "VIA1" } as PcbVia
  const plainHole = {
    type: "pcb_hole",
    pcb_hole_id: "same",
    x: 0,
    y: 0,
    hole_shape: "circle",
    hole_diameter: 0.3,
  } as const
  const errors = checkHoleTraceClearance(
    [namedVia, plainHole, trace("other", 0.35)],
    { minClearance: 0.2 },
  )
  expect(errors).toHaveLength(2)
  expect(new Set(errors.map((error) => error.pcb_trace_error_id)).size).toBe(2)
  expect(errors.some((error) => error.message.includes("VIA1"))).toBe(true)
})

test("unconnected trace intersecting a through drill on inner layer is not missed", async () => {
  const drilled = via("v")
  const inner = trace("other", 0, "inner1")
  const errors = await runAllRoutingChecks([drilled, inner])
  expect(
    errors.some(
      (error) =>
        error.type === "pcb_trace_error" && error.pcb_trace_id === "other",
    ),
  ).toBe(true)
  // On an explicitly listed outer layer, the existing overlap checker reports
  // the collision; the drill-clearance check must not report it a second time.
  expect(
    checkHoleTraceClearance([drilled, trace("other", 0, "top")]),
  ).toHaveLength(0)
})

test("different PCB traces on the same logical net share via connectivity", () => {
  const owner = { ...trace("owner", 1), source_trace_id: "source_trace_a" }
  const sameNet = {
    ...trace("same-net", 0.35),
    source_trace_id: "source_trace_b",
  }
  const otherNet = {
    ...trace("other-net", -0.35),
    source_trace_id: "source_trace_c",
  }
  const elements = [
    {
      type: "source_trace",
      source_trace_id: "source_trace_a",
      connected_source_port_ids: [],
      connected_source_net_ids: ["source_net_a"],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_b",
      connected_source_port_ids: [],
      connected_source_net_ids: ["source_net_a"],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_c",
      connected_source_port_ids: [],
      connected_source_net_ids: ["source_net_b"],
    },
    via("via"),
    owner,
    sameNet,
    otherNet,
  ] as AnyCircuitElement[]
  const errors = checkHoleTraceClearance(elements, { minClearance: 0.2 })
  expect(errors.map((error) => error.pcb_trace_id)).toEqual(["other-net"])
})

test("existing copper-overlap error is not duplicated by the drill rule", async () => {
  const elements = [via("v"), trace("other", 0.29)]
  expect(checkHoleTraceClearance(elements)).toEqual([])
  const errors = (await runAllRoutingChecks(elements)).filter(
    (error) =>
      error.type === "pcb_trace_error" &&
      error.pcb_trace_error_id === "overlap_other_v",
  )
  expect(errors).toHaveLength(1)
})

test("wire/via transitions are reported once and zero-length wires add no copper", async () => {
  const wireA = {
    route_type: "wire",
    x: -1,
    y: 0,
    width: 0.1,
    layer: "top",
  } as const
  const wireB = {
    route_type: "wire",
    x: 1,
    y: 0,
    width: 0.1,
    layer: "top",
  } as const
  const entry = {
    route_type: "via",
    x: -1,
    y: 0,
    from_layer: "top",
    to_layer: "bottom",
  } as const
  const exit = {
    route_type: "via",
    x: 1,
    y: 0,
    from_layer: "top",
    to_layer: "bottom",
  } as const
  const zero = {
    route_type: "wire",
    x: 0,
    y: 0,
    width: 0.1,
    layer: "top",
  } as const
  for (const route of [
    [wireA, exit],
    [entry, wireB],
  ]) {
    const other: PcbTrace = { type: "pcb_trace", pcb_trace_id: "other", route }
    const errors = (await runAllRoutingChecks([via("v"), other])).filter(
      (error) =>
        error.type === "pcb_trace_error" &&
        (error.pcb_trace_error_id === "overlap_other_v" ||
          error.pcb_trace_error_id === "via_drill_clearance_other_v"),
    )
    expect(errors).toHaveLength(1)
  }
  // The geometry converter ignores zero-length segments; they are not copper.
  expect(
    checkHoleTraceClearance([
      via("v"),
      { type: "pcb_trace", pcb_trace_id: "other", route: [zero, zero] },
    ]),
  ).toHaveLength(0)
})
