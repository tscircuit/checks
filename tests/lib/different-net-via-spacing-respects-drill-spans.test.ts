import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbVia } from "circuit-json"
import { checkDifferentNetViaSpacing } from "lib/check-different-net-via-spacing"

test("different-net via spacing checks overlapping drill spans only", () => {
  const cases: Array<[PcbVia["layers"], PcbVia["layers"], number]> = [
    [["top", "inner1"], ["inner2", "bottom"], 0],
    [["top", "inner2"], ["inner2", "bottom"], 1],
    [["top", "bottom"], ["inner2", "inner3"], 1],
    [["inner6", "inner4"], ["inner3", "top"], 0],
  ]
  for (const [layersA, layersB, expected] of cases) {
    const circuit: AnyCircuitElement[] = [
      { type: "pcb_trace", pcb_trace_id: "first", route: [] },
      { type: "pcb_trace", pcb_trace_id: "second", route: [] },
      {
        type: "pcb_via",
        pcb_via_id: "a",
        pcb_trace_id: "first",
        x: 0,
        y: 0,
        hole_diameter: 0.1,
        outer_diameter: 0.3,
        layers: layersA,
      },
      {
        type: "pcb_via",
        pcb_via_id: "b",
        pcb_trace_id: "second",
        x: 0.15,
        y: 0,
        hole_diameter: 0.1,
        outer_diameter: 0.3,
        layers: layersB,
      },
    ]
    expect(
      checkDifferentNetViaSpacing(circuit, { minClearance: 0.1 }),
    ).toHaveLength(expected)
    // Copper clearance also applies to an intermediate layer of a through via.
    ;(circuit[3] as PcbVia).x = 0.35
    expect(
      checkDifferentNetViaSpacing(circuit, { minClearance: 0.1 }),
    ).toHaveLength(expected)
    ;(circuit[3] as PcbVia).x = 0
    expect(
      checkDifferentNetViaSpacing(circuit, { minClearance: 0.1 }),
    ).toHaveLength(expected)
  }
})
