import { expect, spyOn, test } from "bun:test"
import type { AnyCircuitElement, SourceTrace } from "circuit-json"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import * as readableNames from "lib/util/get-readable-names"

test("overlap names are reused across contacts and refreshed between validations", (): void => {
  const sourceTrace: SourceTrace = {
    type: "source_trace",
    source_trace_id: "source_trace_signal",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    display_name: "Signal",
  }
  const circuit: AnyCircuitElement[] = [
    sourceTrace,
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_signal",
      source_trace_id: sourceTrace.source_trace_id,
      route: [
        { route_type: "wire", x: -2, y: 0.45, width: 0.1, layer: "top" },
        { route_type: "wire", x: 2, y: 0.45, width: 0.1, layer: "top" },
      ],
    },
    ...[-0.5, 0.5].map(
      (x, index): AnyCircuitElement => ({
        type: "pcb_smtpad",
        pcb_smtpad_id: `pcb_smtpad_${index}`,
        shape: "rect",
        x,
        y: 0,
        width: 0.4,
        height: 1,
        layer: "top",
      }),
    ),
  ]
  const nameCalls = spyOn(readableNames, "getReadableNameForElementId")
  try {
    const initial = checkEachPcbTraceNonOverlapping(circuit)
    expect(initial).toHaveLength(2)
    expect(
      initial.every((error) => error.message.includes("PCB trace Signal")),
    ).toBe(true)
    expect(nameCalls).toHaveBeenCalledTimes(3)
    sourceTrace.display_name = "Renamed signal"
    nameCalls.mockClear()
    const renamed = checkEachPcbTraceNonOverlapping(circuit)
    expect(
      renamed.every((error) =>
        error.message.includes("PCB trace Renamed signal"),
      ),
    ).toBe(true)
    expect(renamed.map(({ message: _message, ...error }) => error)).toEqual(
      initial.map(({ message: _message, ...error }) => error),
    )
    expect(nameCalls).toHaveBeenCalledTimes(3)
    sourceTrace.display_name = undefined
    expect(
      checkEachPcbTraceNonOverlapping(circuit).every((error) =>
        error.message.includes("PCB trace unnamed trace"),
      ),
    ).toBe(true)
  } finally {
    nameCalls.mockRestore()
  }
})
