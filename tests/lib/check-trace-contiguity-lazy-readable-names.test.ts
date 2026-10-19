import { expect, spyOn, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import * as readableNames from "lib/util/get-readable-names"

test("contiguity resolves names only for errors and preserves named and unnamed diagnostics", (): void => {
  const nameCalls = spyOn(readableNames, "getReadableNameForTrace")
  try {
    for (const named of [true, false]) {
      const traces: PcbTrace[] = [
        {
          type: "pcb_trace",
          pcb_trace_id: "pcb_trace_first",
          source_trace_id: "source_trace_signal",
          route: [
            { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
            { route_type: "wire", x: 5, y: 0, width: 0.2, layer: "top" },
          ],
        },
        {
          type: "pcb_trace",
          pcb_trace_id: "pcb_trace_second",
          source_trace_id: "source_trace_signal",
          route: [
            { route_type: "wire", x: 5, y: 0, width: 0.2, layer: "top" },
            { route_type: "wire", x: 10, y: 0, width: 0.2, layer: "top" },
          ],
        },
      ]
      const circuit: AnyCircuitElement[] = [
        {
          type: "source_trace",
          source_trace_id: "source_trace_signal",
          connected_source_port_ids: ["source_port_a", "source_port_b"],
          connected_source_net_ids: [],
        },
        ...["a", "b"].flatMap((suffix, index): AnyCircuitElement[] => [
          {
            type: "source_component",
            source_component_id: `source_component_${suffix}`,
            ftype: "simple_resistor",
            name: named ? `R${index + 1}` : `source_component_${suffix}`,
          },
          {
            type: "source_port",
            source_port_id: `source_port_${suffix}`,
            source_component_id: `source_component_${suffix}`,
            name: named ? suffix.toUpperCase() : `source_port_${suffix}`,
          },
          {
            type: "pcb_port",
            pcb_port_id: `pcb_port_${suffix}`,
            source_port_id: `source_port_${suffix}`,
            x: index * 10,
            y: 0,
            layers: ["top"],
          },
          {
            type: "pcb_smtpad",
            pcb_smtpad_id: `pcb_smtpad_${suffix}`,
            pcb_port_id: `pcb_port_${suffix}`,
            shape: "rect",
            x: index * 10,
            y: 0,
            width: 0.5,
            height: 0.5,
            layer: "top",
          },
        ]),
        ...traces,
      ]
      nameCalls.mockClear()
      expect(checkTracesAreContiguous(circuit)).toEqual([])
      expect(nameCalls).not.toHaveBeenCalled()

      const secondTraceStart = traces[1]!.route[0]!
      if (secondTraceStart.route_type !== "wire") {
        throw new Error("Test fixture requires a wire endpoint")
      }
      secondTraceStart.x = 6
      expect(checkTracesAreContiguous(circuit)).toEqual([
        {
          type: "pcb_trace_error",
          message: named
            ? "Trace [R1.A to R2.B] is missing a connection to SMD pad R2.B"
            : "Trace [unnamed trace] is missing a connection to SMD pad unnamed port",
          source_trace_id: "source_trace_signal",
          error_type: "pcb_trace_error",
          pcb_trace_id: "pcb_trace_first",
          pcb_trace_error_id: "missing_connection_pcb_trace_first_pcb_port_b",
          center: { x: 5, y: 0 },
          pcb_component_ids: [],
          pcb_port_ids: ["pcb_port_b"],
        },
      ])
      expect(nameCalls).toHaveBeenCalledTimes(1)
    }
  } finally {
    nameCalls.mockRestore()
  }
})
