import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace, PcbVia } from "circuit-json"
import { checkDanglingTraces } from "lib/check-dangling-traces/check-dangling-traces"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

type Wire = Extract<PcbTrace["route"][number], { route_type: "wire" }>
const wire = (x: number, layer: Wire["layer"]): Wire => ({
  route_type: "wire",
  x,
  y: 0,
  layer,
  width: 0.15,
})
function fixture() {
  const target: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "target",
    source_trace_id: "source_target",
    route: [
      wire(-2, "top"),
      wire(0, "top"),
      {
        route_type: "via",
        x: 0,
        y: 0,
        from_layer: "top",
        to_layer: "inner2",
        outer_diameter: 0.3,
      },
      wire(0, "inner2"),
    ],
  }
  const branch: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "branch",
    source_trace_id: "source_branch",
    route: [wire(0.00368, "inner1"), wire(2, "inner1")],
  }
  const via: PcbVia = {
    type: "pcb_via",
    pcb_via_id: "barrel",
    pcb_trace_id: "target",
    x: 0,
    y: 0,
    hole_diameter: 0.15,
    outer_diameter: 0.3,
    layers: ["top", "inner1", "inner2", "bottom"],
  }
  const sourceBranch = {
    type: "source_trace" as const,
    source_trace_id: "source_branch",
    connected_source_port_ids: [],
    connected_source_net_ids: ["net_a"],
  }
  const circuit: AnyCircuitElement[] = [
    {
      type: "source_trace",
      source_trace_id: "source_target",
      connected_source_port_ids: [],
      connected_source_net_ids: ["net_a"],
    },
    sourceBranch,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "anchor",
      pcb_port_id: "anchor_port",
      shape: "rect",
      x: -2,
      y: 0,
      width: 0.3,
      height: 0.3,
      layer: "top",
    },
    target,
    branch,
    via,
  ]
  return { circuit, target, branch, via, sourceBranch }
}
for (const [name, check] of Object.entries({
  dangling: checkDanglingTraces,
  contiguous: checkTracesAreContiguous,
})) {
  describe(`${name}: zero-length terminal wire at a via`, () => {
    const errors = (c: AnyCircuitElement[]) =>
      check(c).filter((e) => e.pcb_trace_id === "target")
    test("accepts onward copper on another layer of the materialized barrel", () => {
      const { circuit } = fixture()
      const before = structuredClone(circuit)
      expect(errors(circuit)).toEqual([])
      expect(circuit).toEqual(before)
    })
    test("accepts the reversed start endpoint", () => {
      const { circuit, target } = fixture()
      target.route.reverse()
      const p = target.route.find((p) => p.route_type === "via")!
      if (p.route_type === "via") {
        p.from_layer = "inner2"
        p.to_layer = "top"
      }
      expect(errors(circuit)).toEqual([])
    })
    test("accepts repeated terminal wire coordinates", () => {
      const { circuit, target } = fixture()
      target.route.push(wire(0, "inner2"))
      expect(errors(circuit)).toEqual([])
    })
    test("rejects an isolated barrel", () => {
      const { circuit, branch } = fixture()
      branch.route = []
      expect(errors(circuit)).toHaveLength(1)
    })
    test("rejects onward copper on a different net", () => {
      const { circuit, sourceBranch } = fixture()
      sourceBranch.connected_source_net_ids = ["net_b"]
      expect(errors(circuit)).toHaveLength(1)
    })
    test("rejects a barrel that does not reach the branch layer", () => {
      const { circuit, via } = fixture()
      via.layers = ["top", "inner2"]
      expect(errors(circuit)).toHaveLength(1)
    })
    test("rejects a barrel that does not reach the endpoint layer", () => {
      const { circuit, via } = fixture()
      via.layers = ["top", "inner1"]
      expect(errors(circuit)).toHaveLength(1)
    })
    test("does not use a nearby via to excuse a misplaced terminal point", () => {
      const { circuit, target } = fixture()
      target.route[target.route.length - 1] = wire(0.05, "inner2")
      expect(errors(circuit).some((e) => e.message.includes("endpoint"))).toBe(
        true,
      )
    })
  })
}

test("terminal through-via junction visual regression", async () => {
  const { convertCircuitJsonToPcbSvg } = await import("circuit-to-svg")
  const { circuit } = fixture()
  circuit.push(
    {
      type: "pcb_board",
      pcb_board_id: "board",
      center: { x: 0, y: 0 },
      width: 6,
      height: 3,
      thickness: 1.6,
      material: "fr4",
      num_layers: 4,
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "branch_anchor",
      pcb_port_id: "branch_port",
      shape: "rect",
      x: 2,
      y: 0,
      width: 0.3,
      height: 0.3,
      layer: "inner1",
    },
  )
  expect(checkDanglingTraces(circuit)).toEqual([])
  expect(checkTracesAreContiguous(circuit)).toEqual([])
  expect(
    convertCircuitJsonToPcbSvg(circuit, { width: 800, height: 400 }),
  ).toMatchSvgSnapshot(import.meta.path, "terminal-through-via-junction")
})
