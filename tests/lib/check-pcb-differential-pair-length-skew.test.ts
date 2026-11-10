import { expect, test } from "bun:test"
import { checkPcbBusLengthSkew } from "../../lib/check-pcb-bus-length-skew"
import { checkPcbRoutingConstraints } from "../../lib/check-pcb-routing-constraints"
import { runAllRoutingChecks } from "../../lib/run-all-checks"
import { pairFixture } from "../fixtures/differential-pair-lengths"

test("P=[4,6] and N=[5,5] have zero lane skew, not 2mm hop skew", () => {
  const { circuit } = pairFixture([4, 6], [5, 5])
  expect(checkPcbBusLengthSkew(circuit)).toEqual([])
})

test("P=[5] and N=[5,5] report 5mm negative lane skew, not zero", () => {
  const { circuit, bus, traces } = pairFixture([5], [5, 5])
  const errors = checkPcbBusLengthSkew(circuit)
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_bus_length_skew_error",
    source_bus_id: bus.source_bus_id,
    source_trace_ids: bus.source_trace_ids,
    pcb_trace_ids: traces.map((t) => t.pcb_trace_id),
    actual_length_skew: 5,
    maximum_length_skew: 0.1,
    differential_pair_lengths: { positive_length: 5, negative_length: 10 },
    subcircuit_id: bus.subcircuit_id,
  })
  expect(errors[0]!.message).toBe(
    "Differential pair USB: negative lane is 5.000mm longer (5.000mm vs 10.000mm); max 0.1mm",
  )
})

test("missing members are coverage errors, not equal remaining hop lengths", () => {
  const { circuit, traces } = pairFixture([5, 5], [5, 5])
  circuit.splice(circuit.indexOf(traces[3]!), 1)
  const errors = checkPcbBusLengthSkew(circuit)
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ type: "pcb_autorouting_error" })
  expect(errors[0]!.message).toContain("USB")
  expect(errors[0]!.message).toContain("N2")
  expect(errors[0]!).not.toHaveProperty("actual_length_skew")
})

test("an empty hop with a cached length is still missing copper", () => {
  const { circuit, traces } = pairFixture([5], [5])
  traces[0]!.route = []
  traces[0]!.trace_length = 5
  expect(checkPcbBusLengthSkew(circuit)).toMatchObject([
    { type: "pcb_autorouting_error" },
  ])
})

test("equal planar lanes with different via counts have no skew", () => {
  const { circuit, traces } = pairFixture([10], [10])
  traces[0]!.route.splice(
    1,
    0,
    { route_type: "via", x: 3, y: 2, from_layer: "top", to_layer: "bottom" },
    { route_type: "wire", x: 5, y: 2, width: 0.2, layer: "bottom" },
    { route_type: "via", x: 7, y: 2, from_layer: "bottom", to_layer: "top" },
  )
  expect(checkPcbBusLengthSkew(circuit)).toEqual([])
})

test("pair skew ignores cached trace_length even when it hides planar skew", () => {
  const { circuit, traces } = pairFixture([21.2], [20])
  for (const trace of traces) trace.trace_length = 100
  const errors = checkPcbBusLengthSkew(circuit)
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    differential_pair_lengths: { positive_length: 21.2, negative_length: 20 },
  })
  expect(errors[0]!.message).toBe(
    "Differential pair USB: positive lane is 1.200mm longer (21.200mm vs 20.000mm); max 0.1mm",
  )
})

test("pair dispatch precedes legacy bus constraints without flattening lanes", () => {
  const { circuit, bus } = pairFixture([4, 6], [5, 5])
  // Imported records must not accidentally enter a generic matching path.
  Object.assign(bus, { length_match_source_trace_ids: [] })
  expect(checkPcbBusLengthSkew(circuit)).toEqual([])
  expect(checkPcbRoutingConstraints(circuit)).toEqual([])
})

test("runAllRoutingChecks returns exactly one measured pair diagnostic", async () => {
  const { circuit } = pairFixture([5], [5, 5])
  const errors = (await runAllRoutingChecks(circuit)).filter(
    (e) => e.type === "pcb_bus_length_skew_error",
  )
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    differential_pair_lengths: { positive_length: 5, negative_length: 10 },
  })
})

test("zero and inclusive skew limits use a 1e-9mm numerical allowance", () => {
  for (const [positive, limit] of [
    [10, 0],
    [10 + 0.5e-9, 0],
    [10.1, 0.1],
  ]) {
    expect(
      checkPcbBusLengthSkew(pairFixture([positive!], [10], limit).circuit),
    ).toEqual([])
  }
  expect(
    checkPcbBusLengthSkew(pairFixture([10 + 2e-9], [10], 0).circuit),
  ).toMatchObject([{ differential_pair_lengths: { negative_length: 10 } }])
})

test("unnamed pair and hop diagnostics do not leak IDs", () => {
  const { circuit, bus, traces } = pairFixture([5], [10])
  bus.name = undefined
  const skew = checkPcbBusLengthSkew(circuit)
  expect(skew[0]!.message).toContain("unnamed")
  expect(skew[0]!.message).not.toContain(bus.source_bus_id)
  for (const element of circuit) {
    if (element.type === "source_trace") element.name = undefined
  }
  circuit.splice(circuit.indexOf(traces[0]!), 1)
  const coverage = checkPcbBusLengthSkew(circuit)
  expect(coverage).toHaveLength(1)
  expect(coverage[0]).toMatchObject({ type: "pcb_autorouting_error" })
  expect(coverage[0]!.message).toContain("unnamed trace")
  expect(coverage[0]!.message).not.toMatch(/source_|pcb_|subcircuit_/)
})
