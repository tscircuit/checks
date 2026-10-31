import { expect, test } from "bun:test"
import { checkScopedCopperClearance } from "../../index"
import { clearanceFixture } from "./scoped-clearance-fixture"

test("EARTH two-millimeter gap fails on both outer layers and passes internally", () => {
  for (const layer of ["top", "bottom", "inner1", "inner2"] as const) {
    const circuit = clearanceFixture(layer)
    const errors = checkScopedCopperClearance(circuit)
    expect(errors.length).toBe(layer.startsWith("inner") ? 0 : 1)
    expect(checkScopedCopperClearance([...circuit].reverse())).toEqual(errors)
    if (errors.length) {
      expect(errors[0]!.minimum_clearance).toBe(4.14)
      expect(errors[0]!.actual_clearance).toBeCloseTo(2, 8)
      expect(errors[0]!.rule_name).toBe("EARTH outer")
      expect(errors[0]!.message).not.toContain("source_net_")
      expect(errors[0]!.message).not.toContain("pcb_trace_")
    }
    const signal = circuit.find(
      (element) => element.type === "source_trace" && element.name === "signal",
    )!
    if (signal.type === "source_trace")
      signal.connected_source_net_ids = ["source_net_earth"]
    expect(checkScopedCopperClearance(circuit)).toEqual([])
  }
})
