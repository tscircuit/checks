import { expect, test } from "bun:test"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

import { fixture } from "./via-barrel-fixture"

test("through-via barrels connect top pads through an inner-layer trace", () => {
  expect(checkTracesAreContiguous(structuredClone(fixture))).toEqual([])
})

test("removing a plated barrel really disconnects the two pads", () => {
  const withoutVia = fixture.filter(
    (e) =>
      !(e.type === "pcb_via" && e.pcb_via_id === "via_1") &&
      !(e.type === "pcb_trace" && e.pcb_trace_id === "via_trace_1"),
  )
  expect(
    checkTracesAreContiguous(structuredClone(withoutVia)).some((e) =>
      e.message.includes("missing a connection"),
    ),
  ).toBe(true)
})

test("a blind via that does not reach inner2 cannot connect the bridge", () => {
  const circuit = structuredClone(fixture)
  for (const e of circuit)
    if (e.type === "pcb_via") e.layers = ["top", "inner1"]
  expect(
    checkTracesAreContiguous(circuit).some((e) =>
      e.message.includes("missing a connection"),
    ),
  ).toBe(true)
})

test("copper ending outside the via annulus remains disconnected", () => {
  const circuit = structuredClone(fixture)
  const bridge = circuit.find(
    (e) => e.type === "pcb_trace" && e.pcb_trace_id === "trace_middle",
  )!
  if (bridge.type === "pcb_trace" && bridge.route[0]?.route_type === "wire")
    bridge.route[0].x = 1.25
  expect(
    checkTracesAreContiguous(circuit).some((e) =>
      e.message.includes("missing a connection"),
    ),
  ).toBe(true)
})

test("copper touching the via annulus connects without reaching its center", () => {
  const circuit = structuredClone(fixture)
  const bridge = circuit.find(
    (e) => e.type === "pcb_trace" && e.pcb_trace_id === "trace_middle",
  )!
  if (bridge.type === "pcb_trace" && bridge.route[0]?.route_type === "wire")
    bridge.route[0].x = 1.1
  expect(checkTracesAreContiguous(circuit)).toEqual([])
})

test("route-only through vias connect inner layers when their diameter is known", () => {
  const circuit = structuredClone(fixture).filter((e) => e.type !== "pcb_via")
  for (const e of circuit)
    if (e.type === "pcb_trace")
      for (const point of e.route)
        if (point.route_type === "via") point.outer_diameter = 0.3
  expect(checkTracesAreContiguous(circuit)).toEqual([])
})

const withPour = () => {
  const circuit = structuredClone(fixture).filter(
    (e) => !(e.type === "pcb_trace" && e.pcb_trace_id === "trace_middle"),
  )
  const pour = {
    type: "pcb_copper_pour" as const,
    pcb_copper_pour_id: "pour",
    source_net_id: "net",
    shape: "brep" as const,
    layer: "inner2" as const,
    covered_with_solder_mask: true,
    brep_shape: {
      outer_ring: {
        vertices: [
          { x: 0.5, y: -1 },
          { x: 3.5, y: -1 },
          { x: 3.5, y: 1 },
          { x: 0.5, y: 1 },
        ],
      },
      inner_rings: [] as { vertices: { x: number; y: number }[] }[],
    },
  }
  circuit.push(pour)
  return { circuit, pour }
}

test("a shared inner-layer pour joins the two through-via escapes", () => {
  expect(checkTracesAreContiguous(withPour().circuit)).toEqual([])
})

test("a pour cutout around a via leaves that escape disconnected", () => {
  const { circuit, pour } = withPour()
  pour.brep_shape.inner_rings.push({
    vertices: [
      { x: 0.7, y: -0.3 },
      { x: 0.7, y: 0.3 },
      { x: 1.3, y: 0.3 },
      { x: 1.3, y: -0.3 },
    ],
  })
  expect(
    checkTracesAreContiguous(circuit).some((e) =>
      e.message.includes("missing a connection"),
    ),
  ).toBe(true)
})
