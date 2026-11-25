import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkHoleTraceClearance } from "lib/check-hole-trace-clearance"

test("a terminal width cannot hide a positive trace-to-hole clearance violation", () => {
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "signal",
    source_trace_id: "source-signal",
    route: [
      { route_type: "wire", x: -1, y: 0, width: 0.1, layer: "top" },
      { route_type: "wire", x: 1, y: 0, width: 0.4, layer: "top" },
    ],
  }
  const circuit: AnyCircuitElement[] = [
    trace,
    {
      type: "pcb_hole",
      pcb_hole_id: "mounting-hole",
      hole_shape: "circle",
      x: 0,
      y: 0.3,
      hole_diameter: 0.3,
    },
  ]
  expect(checkEachPcbTraceNonOverlapping(circuit)).toEqual([])
  const errors = checkHoleTraceClearance(circuit, { minClearance: 0.2 })
  expect(errors).toHaveLength(1)
  expect(errors[0]!.message).toContain("gap: 0.100000mm")
  expect(errors[0]!.message).toContain("unnamed hole")
  expect(errors[0]!.pcb_trace_error_id).toBe("overlap_signal_mounting-hole")
  const safe = structuredClone(circuit)
  Object.assign(safe[1]!, { y: 0.5 })
  expect(checkHoleTraceClearance(safe, { minClearance: 0.2 })).toEqual([])
  const overlapping = structuredClone(circuit)
  Object.assign((overlapping[0] as PcbTrace).route[0]!, { width: 0.4 })
  expect(checkEachPcbTraceNonOverlapping(overlapping)).toHaveLength(1)
  expect(checkHoleTraceClearance(overlapping, { minClearance: 0.2 })).toEqual(
    [],
  )
})
