import { expect, spyOn, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace, SourceTrace } from "circuit-json"
import { checkPadTraceClearance } from "lib/check-pad-trace-clearance"
import { checkViaTraceClearance } from "lib/check-via-trace-clearance"
import * as readableNames from "lib/util/get-readable-names"

test("clearance checks retain the worst contact and resolve names once per validation", (): void => {
  const nameCalls = spyOn(readableNames, "getReadableNameForElementId")
  try {
    for (const kind of ["pad", "via"] as const) {
      const sourceTrace: SourceTrace = {
        type: "source_trace",
        source_trace_id: "source_trace_signal",
        connected_source_port_ids: [],
        connected_source_net_ids: [],
        display_name: "Signal",
      }
      const trace: PcbTrace = {
        type: "pcb_trace",
        pcb_trace_id: "pcb_trace_signal",
        source_trace_id: sourceTrace.source_trace_id,
        route: [
          { route_type: "wire", x: -1, y: 0.69, width: 0.1, layer: "top" },
          { route_type: "wire", x: 1, y: 0.69, width: 0.1, layer: "top" },
          { route_type: "wire", x: 1, y: 0.625, width: 0.1, layer: "top" },
          { route_type: "wire", x: -1, y: 0.625, width: 0.1, layer: "top" },
          { route_type: "wire", x: -1, y: 0.65, width: 0.1, layer: "top" },
          { route_type: "wire", x: 1, y: 0.65, width: 0.1, layer: "top" },
        ],
      }
      const obstacle: AnyCircuitElement =
        kind === "pad"
          ? {
              type: "pcb_smtpad",
              pcb_smtpad_id: "pcb_smtpad_foreign",
              shape: "rect",
              x: 0,
              y: 0,
              width: 1,
              height: 1,
              layer: "top",
            }
          : {
              type: "pcb_via",
              pcb_via_id: "pcb_via_foreign",
              x: 0,
              y: 0,
              hole_diameter: 0.5,
              outer_diameter: 1,
              layers: ["top", "bottom"],
            }
      const circuit: AnyCircuitElement[] = [sourceTrace, trace, obstacle]
      const check =
        kind === "pad" ? checkPadTraceClearance : checkViaTraceClearance
      nameCalls.mockClear()
      const named = check(circuit, { minClearance: 0.2 })
      expect(named).toHaveLength(1)
      expect(named[0]!.actual_clearance).toBeCloseTo(0.075, 10)
      expect(named[0]!.message).toContain("trace Signal")
      expect(nameCalls).toHaveBeenCalledTimes(2)

      sourceTrace.display_name = "Renamed signal"
      nameCalls.mockClear()
      const renamed = check(circuit, { minClearance: 0.2 })
      expect(renamed[0]!.message).toContain("trace Renamed signal")
      expect(renamed.map(({ message: _message, ...error }) => error)).toEqual(
        named.map(({ message: _message, ...error }) => error),
      )
      expect(nameCalls).toHaveBeenCalledTimes(2)

      sourceTrace.display_name = undefined
      const unnamed = check(circuit, { minClearance: 0.2 })
      expect(unnamed[0]!.message).toContain("trace unnamed trace")
      expect(unnamed[0]!.message).not.toContain("pcb_trace_signal")
    }
  } finally {
    nameCalls.mockRestore()
  }
})
